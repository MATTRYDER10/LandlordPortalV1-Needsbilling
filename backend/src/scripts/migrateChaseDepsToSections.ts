import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrateChaseDepenenciesToSections() {
  console.log('=== MIGRATING CHASE_DEPENDENCIES TO VERIFICATION_SECTIONS ===\n');

  // Get all references with chase dependencies for external refs
  const { data: deps, error: depsError } = await supabase
    .from('chase_dependencies')
    .select(`
      *,
      reference:tenant_references!chase_dependencies_reference_id_fkey (
        id,
        verification_state,
        status
      )
    `)
    .in('dependency_type', ['EMPLOYER_REF', 'RESIDENTIAL_REF', 'ACCOUNTANT_REF']);

  if (depsError) {
    console.error('Failed to fetch chase_dependencies:', depsError);
    return;
  }

  console.log(`Found ${deps?.length || 0} chase dependencies for external references\n`);

  if (!deps || deps.length === 0) {
    console.log('No dependencies to migrate');
    return;
  }

  // Group by reference_id
  const depsByReference = deps.reduce((acc: any, dep: any) => {
    if (!acc[dep.reference_id]) {
      acc[dep.reference_id] = [];
    }
    acc[dep.reference_id].push(dep);
    return acc;
  }, {});

  console.log(`References with dependencies: ${Object.keys(depsByReference).length}\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const [referenceId, refDeps] of Object.entries(depsByReference)) {
    const depsArray = refDeps as any[];

    // Check if verification_sections already exist for this reference
    const { data: existingSections } = await supabase
      .from('verification_sections')
      .select('section_type')
      .eq('reference_id', referenceId)
      .in('section_type', ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'ACCOUNTANT_REFERENCE']);

    const existingSectionTypes = existingSections?.map(s => s.section_type) || [];

    // Map dependency types to section types
    const externalRefMap: Record<string, { sectionType: string; order: number }> = {
      'EMPLOYER_REF': { sectionType: 'EMPLOYER_REFERENCE', order: 1 },
      'RESIDENTIAL_REF': { sectionType: 'LANDLORD_REFERENCE', order: 2 },
      'ACCOUNTANT_REF': { sectionType: 'ACCOUNTANT_REFERENCE', order: 3 }
    };

    const sectionsToCreate = depsArray
      .map(dep => {
        let sectionType = externalRefMap[dep.dependency_type]?.sectionType;

        if (!sectionType) return null;

        // NOTE: AGENT_REFERENCE is not allowed in database constraint
        // Use LANDLORD_REFERENCE for all residential refs
        // Original code tried to set AGENT_REFERENCE for agent_references table, but this fails
        // if (dep.dependency_type === 'RESIDENTIAL_REF' && dep.linked_table === 'agent_references') {
        //   sectionType = 'AGENT_REFERENCE';
        // }

        // Skip if section already exists
        if (existingSectionTypes.includes(sectionType)) {
          return null;
        }

        return {
          reference_id: referenceId,
          person_type: 'TENANT',
          section_type: sectionType,
          section_order: externalRefMap[dep.dependency_type].order,
          decision: 'NOT_REVIEWED',
          contact_name_encrypted: dep.contact_name_encrypted,
          contact_email_encrypted: dep.contact_email_encrypted,
          contact_phone_encrypted: dep.contact_phone_encrypted,
          initial_request_sent_at: dep.initial_request_sent_at
        };
      })
      .filter(s => s !== null);

    if (sectionsToCreate.length === 0) {
      skippedCount++;
      continue;
    }

    // Insert sections
    const { error: insertError } = await supabase
      .from('verification_sections')
      .upsert(sectionsToCreate, { onConflict: 'reference_id,section_type' });

    if (insertError) {
      console.error(`❌ Failed to create sections for reference ${referenceId}:`, insertError);
      errorCount++;
    } else {
      console.log(`✅ Created ${sectionsToCreate.length} sections for reference ${referenceId}`);
      migratedCount++;
    }
  }

  console.log('\n=== MIGRATION COMPLETE ===');
  console.log(`References migrated: ${migratedCount}`);
  console.log(`References skipped (already had sections): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('\nPending Responses queue should now show all outstanding external references!');
}

migrateChaseDepenenciesToSections();

/**
 * Script to set up Supabase Storage bucket for Credas verification PDFs
 * Run this to create the storage bucket and policies
 *
 * Usage:
 *   npx ts-node scripts/setup-credas-storage.ts
 */

import { supabase } from '../src/config/supabase';

async function setupStorage() {
  try {
    console.log('🗄️  Setting up Credas verification PDFs storage bucket...\n');

    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      process.exit(1);
    }

    const bucketExists = buckets?.some(b => b.id === 'credas-verification-pdfs');

    if (bucketExists) {
      console.log('✅ Bucket "credas-verification-pdfs" already exists!\n');
      console.log('📋 Existing bucket configuration:');
      const bucket = buckets?.find(b => b.id === 'credas-verification-pdfs');
      console.log(`   ID: ${bucket?.id}`);
      console.log(`   Name: ${bucket?.name}`);
      console.log(`   Public: ${bucket?.public}`);
      console.log(`   Created: ${bucket?.created_at}\n`);
    } else {
      console.log('📦 Creating bucket "credas-verification-pdfs"...');

      const { data: newBucket, error: createError } = await supabase.storage.createBucket(
        'credas-verification-pdfs',
        {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['application/pdf'],
        }
      );

      if (createError) {
        console.error('❌ Error creating bucket:', createError);
        process.exit(1);
      }

      console.log('✅ Bucket created successfully!\n');
    }

    console.log('─'.repeat(80));
    console.log('\n🔐 Storage Policies:\n');
    console.log('The following RLS policies need to be set up in the Supabase dashboard:');
    console.log('(Go to Storage > credas-verification-pdfs > Policies)\n');
    console.log('1️⃣  Policy: "Company members can view verification PDFs"');
    console.log('   Operation: SELECT');
    console.log('   Target: storage.objects');
    console.log('   Policy:\n');
    console.log(`   bucket_id = 'credas-verification-pdfs' AND
   (storage.foldername(name))[1] IN (
     SELECT tr.id::text
     FROM tenant_references tr
     INNER JOIN company_users cu ON cu.company_id = tr.company_id
     WHERE cu.user_id = auth.uid()
   )`);
    console.log('\n2️⃣  Policy: "System can upload verification PDFs"');
    console.log('   Operation: INSERT');
    console.log('   Target: storage.objects');
    console.log('   Policy:\n');
    console.log(`   bucket_id = 'credas-verification-pdfs'`);
    console.log('\n3️⃣  Policy: "System can update verification PDFs"');
    console.log('   Operation: UPDATE');
    console.log('   Target: storage.objects');
    console.log('   Policy:\n');
    console.log(`   bucket_id = 'credas-verification-pdfs'`);
    console.log('\n4️⃣  Policy: "System can delete verification PDFs"');
    console.log('   Operation: DELETE');
    console.log('   Target: storage.objects');
    console.log('   Policy:\n');
    console.log(`   bucket_id = 'credas-verification-pdfs'`);
    console.log('\n─'.repeat(80));
    console.log('\n💡 Alternative: Run the SQL in migrations/017_create_credas_storage_bucket.sql');
    console.log('   in the Supabase SQL Editor to set up policies automatically.\n');
    console.log('✅ Storage bucket setup complete!\n');

  } catch (error: any) {
    console.error('\n❌ Error setting up storage:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run the script
setupStorage();

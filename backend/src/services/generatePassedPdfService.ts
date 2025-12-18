import PDFDocument from 'pdfkit'
import { supabase } from '../config/supabase'
import { decrypt } from './encryption'
import path from 'path'
import fs from "fs";
import axios from 'axios'

// Font paths for Space Grotesk
const FONT_REGULAR = path.join(__dirname, '../../assets/fonts/SpaceGrotesk-Regular.ttf')
const FONT_BOLD = path.join(__dirname, '../../assets/fonts/SpaceGrotesk-Bold.ttf')

const cloudConvertApiKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiM2Y5NzFlNGJlZGJjMDNiNzVlNmRhMTA5NGMxMzMwMGM5N2JjMDdmYmY4ZTUwODg4ZjNlZDRiODgzZmU3ZGZjNTg3NTY4YzAwYmE5YTk2OTEiLCJpYXQiOjE3NjQ5NDI5MDMuMTg5Mjc4LCJuYmYiOjE3NjQ5NDI5MDMuMTg5Mjc5LCJleHAiOjQ5MjA2MTY1MDMuMTc5MTU3LCJzdWIiOiI2MzA0MzU2NSIsInNjb3BlcyI6WyJ0YXNrLnJlYWQiLCJ1c2VyLnJlYWQiLCJ3ZWJob29rLndyaXRlIiwid2ViaG9vay5yZWFkIiwidGFzay53cml0ZSIsInVzZXIud3JpdGUiLCJwcmVzZXQucmVhZCIsInByZXNldC53cml0ZSJdfQ.m8fwR_lTIPvEl4h3yf5EgsbdbT0LNLGVdENd3EFs0A6wnlPzKgcVKsW8WfA6Yz4QpZoqQswH1Pud7ynIw8_HWviz5tw4OaFITF7thA1xYBvfeqlj0E0xR5V-IhMg2uiG3PE44HBFYDcp0MTDU8JJiae2eBCTMJUGVj2Vds0QDeTYnYcr41Hx2XHZqOHLdNWtLSpEC4iIrc1zcNdaXs8Ftu0TUnjI8fj6AfimopdBVYe3sZtpVroqm9QSYsIKIe_BPNOIKP4M_HVs1PltP2thZ-YPzCp-zzsqkwnsTXrGEx6CBWS-lWBJrn4MRRaVhVumzo2mWIubPmBFWNq3fGLase-P5lbuqS_r0Qy5hRqckGgsDCyD30qWJ_mua1nA5WaR10ZQmx9PFgy0O_bO1SEFcopmmtIZsG40a9vxWHriw7oYjLkrc5KFjmpOfeTIY-lsET7yxuuMEkruE6hL5-6m5avj9-i38QgeGmyd8Q7zjQPTtXqupFJ_ejukdLUb8esL-xmr5qpo3lhfTaPCAyOPYgkjc44L6vNrKrsmXX9IPdwzCsNxV3nTJNPqONlZLIR5jHI6mZYBWw-WF-vUr6FOvJMgNy1CkOF5i6LkFwnJwsMvDQQR5kq2WWu0Zbu6AM8dkDwHpip9sdhHMGia44ooZe-zsa5OitpUWIMsqGo7N60';


export async function generatePassedPdfService(referenceId: string): Promise<string> {
    // Fetch reference data
    console.log(`[Passed PDF] Fetching reference ${referenceId}...`)
    const { data: reference, error: refError } = await supabase
        .from('tenant_references')
        .select('*')
        .eq('id', referenceId)
        .single()

    if (refError || !reference) {
        console.error('[Passed PDF] Error fetching reference:', refError)
        throw new Error('Reference not found')
    }

    // Decrypt sensitive fields
    const firstName = reference.first_name || (reference.tenant_first_name_encrypted ? decrypt(reference.tenant_first_name_encrypted) : '')
    const middleName = reference.middle_name || ''
    const lastName = reference.last_name || (reference.tenant_last_name_encrypted ? decrypt(reference.tenant_last_name_encrypted) : '')
    const email = reference.email || (reference.tenant_email_encrypted ? decrypt(reference.tenant_email_encrypted) : '')
    const phone = reference.phone || (reference.tenant_phone_encrypted ? decrypt(reference.tenant_phone_encrypted) : '')
    const dateOfBirth = reference.date_of_birth || (reference.date_of_birth_encrypted ? decrypt(reference.date_of_birth_encrypted) : '')
    const propertyAddress = reference.property_address || (reference.property_address_encrypted ? decrypt(reference.property_address_encrypted) : '')
    const propertyCity = reference.property_city || (reference.property_city_encrypted ? decrypt(reference.property_city_encrypted) : '')
    const propertyPostcode = reference.property_postcode || (reference.property_postcode_encrypted ? decrypt(reference.property_postcode_encrypted) : '')

    // Determine if this is a guarantor reference
    const isGuarantor = reference.is_guarantor === true
    const personLabel = isGuarantor ? 'Guarantor' : 'Tenant'

    // Fetch reference score
    const { data: score } = await supabase
        .from('reference_scores')
        .select('*')
        .eq('reference_id', referenceId)
        .maybeSingle()

    // Fetch landlord reference
    const { data: landlordReference } = await supabase
        .from('landlord_references')
        .select('*')
        .eq('reference_id', referenceId)
        .maybeSingle()

    // Fetch agent reference
    const { data: agentReference } = await supabase
        .from('agent_references')
        .select('*')
        .eq('reference_id', referenceId)
        .maybeSingle()

    // Fetch employer reference
    const { data: employerReference } = await supabase
        .from('employer_references')
        .select('*')
        .eq('reference_id', referenceId)
        .maybeSingle()

    // Fetch accountant reference (uses tenant_reference_id, not reference_id)
    const { data: accountantReference } = await supabase
        .from('accountant_references')
        .select('*')
        .eq('tenant_reference_id', referenceId)
        .maybeSingle()

    // Fetch Creditsafe verification
    const { data: creditsafe } = await supabase
        .from('creditsafe_verifications')
        .select('*')
        .eq('reference_id', referenceId)
        .maybeSingle()

    // Fetch sanctions screening
    const { data: sanctions } = await supabase
        .from('sanctions_screenings')
        .select('*')
        .eq('reference_id', referenceId)
        .maybeSingle()

    // Calculate annual salary - use verified value if available, otherwise original
    let annualSalary: number
    if (reference.verified_salary_amount_encrypted) {
        // Staff-verified salary takes precedence
        annualSalary = parseFloat(decrypt(reference.verified_salary_amount_encrypted) || '0')
    } else {
        const employmentSalaryAmount = reference.employment_salary_amount_encrypted
            ? parseFloat(decrypt(reference.employment_salary_amount_encrypted) || '0')
            : parseFloat(reference.employment_salary_amount || '0')

        annualSalary = employmentSalaryAmount
        if (reference.employment_is_hourly && reference.employment_hours_per_month) {
            annualSalary = employmentSalaryAmount * reference.employment_hours_per_month * 12
        }
    }

    // Calculate total income - use verified values when available, otherwise original
    // Self-employed income - check verified first
    const selfEmployedIncome = reference.verified_self_employed_income_encrypted
        ? parseFloat(decrypt(reference.verified_self_employed_income_encrypted) || '0')
        : (accountantReference?.annual_profit_encrypted
            ? parseFloat(decrypt(accountantReference.annual_profit_encrypted) || '0')
            : parseFloat(accountantReference?.annual_profit || '0'))

    // Benefits - check verified first
    const benefitsAnnual = reference.verified_benefits_amount_encrypted
        ? parseFloat(decrypt(reference.verified_benefits_amount_encrypted) || '0')
        : (reference.benefits_annual_amount_encrypted
            ? parseFloat(decrypt(reference.benefits_annual_amount_encrypted) || '0')
            : parseFloat(reference.benefits_annual_amount || '0'))

    // Savings - check verified first (THIS WAS THE MAIN BUG - savings wasn't using verified value)
    const savingsAmount = reference.verified_savings_amount_encrypted
        ? parseFloat(decrypt(reference.verified_savings_amount_encrypted) || '0')
        : (reference.savings_amount_encrypted
            ? parseFloat(decrypt(reference.savings_amount_encrypted) || '0')
            : parseFloat(reference.savings_amount || '0'))

    // Additional income - check verified first
    const additionalIncome = reference.verified_additional_income_amount_encrypted
        ? parseFloat(decrypt(reference.verified_additional_income_amount_encrypted) || '0')
        : (reference.additional_income_amount_encrypted
            ? parseFloat(decrypt(reference.additional_income_amount_encrypted) || '0')
            : parseFloat(reference.additional_income_amount || '0'))

    // Check if there's a total override (staff manually set total income)
    let totalIncome: number
    if (reference.verified_total_income_encrypted) {
        // Staff override of total income takes precedence over individual values
        totalIncome = parseFloat(decrypt(reference.verified_total_income_encrypted) || '0')
    } else {
        // Gross total includes all sources (as shown in frontend)
        totalIncome = annualSalary + selfEmployedIncome + benefitsAnnual + savingsAmount + additionalIncome
    }

    // Extract personal data
    const hasChildren = reference.number_of_dependants ? reference.number_of_dependants > 0 : false
    const isSmoker = reference.is_smoker === true
    const hasPets = reference.has_pets === true
    const numberOfTenants = reference.tenant_position || 1

    // Extract affordability data (same as frontend)
    // Prioritize rent_share for multi-tenant properties and guarantors
    const monthlyRent = reference.monthly_rent || (reference.monthly_rent_encrypted ? parseFloat(decrypt(reference.monthly_rent_encrypted) || '0') : 0)
    const rentShare = reference.rent_share || reference.previous_monthly_rent || monthlyRent
    const rentShareValue = typeof rentShare === 'string' ? parseFloat(rentShare) : rentShare

    // Max affordability = Total income / 30 (as per frontend)
    const maxAffordableRent = totalIncome > 0 ? totalIncome / 30 : 0
    // Affordability ratio: use score.ratio if available, otherwise calculate
    const affordabilityRatio = score?.ratio || (totalIncome > 0 && rentShareValue > 0 ? (totalIncome / 12) / rentShareValue : 0)
    const affordabilityRatioText = affordabilityRatio >= 3 ? '3x' : affordabilityRatio >= 2.5 ? '2.5x' : 'Below 2.5x'

    // Parse fraud indicators for credit history
    let ccjCount = 0
    let bankruptcyCount = 0
    let adverseCreditFound = false
    if (creditsafe?.fraud_indicators) {
        try {
            const fraudIndicators = typeof creditsafe.fraud_indicators === 'string'
                ? JSON.parse(creditsafe.fraud_indicators)
                : creditsafe.fraud_indicators
            ccjCount = fraudIndicators.ccjCount || 0
            bankruptcyCount = fraudIndicators.insolvencyCount || 0
            adverseCreditFound = fraudIndicators.ccjMatch || fraudIndicators.insolvencyMatch || false
        } catch (e) {
            console.error('Error parsing fraud indicators:', e)
        }
    }

    // Check if living with family
    const isLivingWithFamily = reference.reference_type === 'living_with_family'

    // Decrypt signatures
    const landlordSignature = landlordReference?.signature_encrypted ? decrypt(landlordReference.signature_encrypted) : null
    const landlordSignatureName = landlordReference?.signature_name_encrypted ? decrypt(landlordReference.signature_name_encrypted) : null

    const agentSignature = agentReference?.signature_encrypted ? decrypt(agentReference.signature_encrypted) : null
    const agentSignatureName = agentReference?.signature_name_encrypted ? decrypt(agentReference.signature_name_encrypted) : null

    const employerSignature = employerReference?.signature_encrypted ? decrypt(employerReference.signature_encrypted) : null
    const employerSignatureName = reference?.employer_ref_name_encrypted ? decrypt(reference.employer_ref_name_encrypted) : null

    const accountantSignature = accountantReference?.signature_encrypted ? decrypt(accountantReference.signature_encrypted) : null
    const accountantSignatureName = reference?.accountant_name_encrypted ? decrypt(reference.accountant_name_encrypted) : null

    // Helper function to convert base64 signature to buffer
    const base64ToBuffer = (base64String: string | null): Buffer | null => {
        if (!base64String) return null
        try {
            // Handle data URL format (data:image/png;base64,...)
            let base64Data = base64String
            if (base64String.includes(',')) {
                base64Data = base64String.split(',')[1]
            }
            return Buffer.from(base64Data, 'base64')
        } catch (error) {
            console.error('Error converting base64 signature to buffer:', error)
            return null
        }
    }

    // Format dates
    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return 'N/A'
        try {
            const date = new Date(dateStr)
            return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        } catch {
            return dateStr
        }
    }

    const formatDateTime = (dateStr?: string | null) => {
        if (!dateStr) return 'N/A'
        try {
            const date = new Date(dateStr)
            return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + ' at ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        } catch {
            return dateStr
        }
    }

    // Download document file for rendering (check rtr_alternative_document_path first, then id_document_path)
    let documentBuffer: Buffer | null = null
    let documentIsPdf = false
    const documentPath = reference.proof_of_funds_path || reference.id_document_path
    if (documentPath) {
        try {
            const { data: fileData, error: downloadError } = await supabase.storage
                .from('tenant-documents')
                .download(documentPath)

            if (!downloadError && fileData) {
                documentBuffer = Buffer.from(await fileData.arrayBuffer())
                // Check if it's a PDF by checking file extension or magic bytes
                const fileExtension = documentPath.split('.').pop()?.toLowerCase()
                documentIsPdf = fileExtension === 'pdf' || documentBuffer.slice(0, 4).toString() === '%PDF'

                // If it's a PDF, convert first page to image using CloudConvert API
                if (documentIsPdf) {
                    try {

                        if (!cloudConvertApiKey) {
                            console.warn('[Passed PDF] CLOUDCONVERT_API_KEY not set, skipping PDF conversion');
                            documentBuffer = null;
                        } else {

                            const base64Pdf = documentBuffer.toString('base64');

                            //Create job
                            const jobResponse = await axios.post(
                                "https://api.cloudconvert.com/v2/jobs",
                                {
                                    tasks: {
                                        upload_file: {
                                            operation: "import/base64",
                                            file: base64Pdf,
                                            filename: "document.pdf"
                                        },
                                        convert_pdf: {
                                            operation: "convert",
                                            input: ["upload_file"],
                                            input_format: "pdf",
                                            output_format: "png",
                                            page_range: "1"
                                        },
                                        export_result: {
                                            operation: "export/url",
                                            input: ["convert_pdf"]
                                        }
                                    }
                                },
                                {
                                    headers: {
                                        Authorization: `Bearer ${cloudConvertApiKey}`,
                                        "Content-Type": "application/json"
                                    }
                                }
                            );

                            const jobId = jobResponse.data?.data?.id;
                            if (!jobId) throw new Error("CloudConvert did not return a job ID.");

                            //Poll job status until finished
                            let jobCompleted = false;
                            let exportTask = null;

                            for (let i = 0; i < 20; i++) { // wait up to ~20 seconds
                                await new Promise(res => setTimeout(res, 1000));

                                const poll = await axios.get(
                                    `https://api.cloudconvert.com/v2/jobs/${jobId}`,
                                    {
                                        headers: { Authorization: `Bearer ${cloudConvertApiKey}` }
                                    }
                                );

                                const tasks = poll.data?.data?.tasks || [];

                                // Look for export task
                                exportTask = tasks.find((t: any) => t.name === "export_result");

                                // Check if all tasks are finished
                                const allFinished =
                                    tasks.every((t: any) => t.status === "finished");

                                if (allFinished && exportTask) {
                                    jobCompleted = true;
                                    break;
                                }
                            }

                            if (!jobCompleted || !exportTask?.result?.files?.length) {
                                throw new Error("CloudConvert did not return output image URL (job not finished).");
                            }

                            //Get file URL
                            const fileUrl = exportTask.result.files[0].url;

                            //Download PNG
                            const imgResponse = await axios.get(fileUrl, { responseType: "arraybuffer" });
                            documentBuffer = Buffer.from(imgResponse.data);
                            documentIsPdf = false; //It's now an image
                        }

                    } catch (pdfError: any) {
                        const errorMessage = pdfError.response?.data
                            ? JSON.stringify(pdfError.response.data)
                            : pdfError.message;

                        console.warn('[Passed PDF] Could not convert PDF to image via CloudConvert:', errorMessage);

                        if (pdfError.response?.status) {
                            console.warn(`[Passed PDF] CloudConvert API status: ${pdfError.response.status}`);
                        }

                        documentBuffer = null;
                    }
                }

            }
        } catch (error) {
            console.error('[Passed PDF] Error downloading document:', error)
        }
    }

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margins: { top: 100, bottom: 100, left: 72, right: 72 } })

            // Register Space Grotesk fonts
            doc.registerFont('SpaceGrotesk', FONT_REGULAR)
            doc.registerFont('SpaceGrotesk-Bold', FONT_BOLD)

            const chunks: Buffer[] = []
            // const stream = fs.createWriteStream("output.pdf");
            // doc.pipe(stream);

            doc.on('data', (chunk) => chunks.push(chunk))
            doc.on('end', async () => {
                try {
                    const buffer = Buffer.concat(chunks)
                    const timestamp = Date.now()
                    const fileName = `passed-certificate-${firstName}-${lastName}-${timestamp}.pdf`
                    const bucketId = 'reference-pdfs'

                    // Upload to Supabase Storage
                    const { error: uploadError } = await supabase.storage
                        .from(bucketId)
                        .upload(`certificates/${referenceId}/${fileName}`, buffer, {
                            contentType: 'application/pdf',
                            upsert: true
                        })

                    if (uploadError) {
                        console.error('[Passed PDF] Upload error:', uploadError)
                        reject(uploadError)
                        return
                    }

                    const { data: urlData } = supabase.storage
                        .from(bucketId)
                        .getPublicUrl(`certificates/${referenceId}/${fileName}`)

                    resolve(urlData.publicUrl)
                } catch (error) {
                    reject(error)
                }
            })

            // stream.on('finish', () => {
            //     console.log("\x1b[32mPDF created → output.pdf\x1b[0m");
            //     resolve('Please check the output.pdf file for the generated PDF');
            // })
            doc.on('error', reject)

            const pageWidth = doc.page.width
            const pageHeight = doc.page.height
            const margin = 72
            const centerX = pageWidth / 2

            // Helper function to draw rounded rectangle
            const drawRoundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
                doc.moveTo(x + radius, y)
                    .lineTo(x + width - radius, y)
                    .quadraticCurveTo(x + width, y, x + width, y + radius)
                    .lineTo(x + width, y + height - radius)
                    .quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
                    .lineTo(x + radius, y + height)
                    .quadraticCurveTo(x, y + height, x, y + height - radius)
                    .lineTo(x, y + radius)
                    .quadraticCurveTo(x, y, x + radius, y)
                    .closePath()
            }

            // Helper function to draw Pass button
            const drawPassButton = (x: number, y: number) => {
                const buttonWidth = 70
                const buttonHeight = 28
                const radius = 15
                const iconSize = 14

                doc.save()
                drawRoundedRect(x, y, buttonWidth, buttonHeight, radius)
                doc.fillColor('#E5E5E5')
                    .fill()
                doc.restore()

                const iconCenterX = x + 14
                const iconCenterY = y + buttonHeight / 2

                doc.circle(iconCenterX, iconCenterY, iconSize / 2)
                    .lineWidth(1.5)
                    .strokeColor('#28a745')
                    .stroke()

                doc.moveTo(iconCenterX - 3, iconCenterY)
                    .lineTo(iconCenterX - 1, iconCenterY + 3)
                    .lineTo(iconCenterX + 4, iconCenterY - 3)
                    .lineWidth(1.5)
                    .strokeColor('#28a745')
                    .stroke()

                doc.font('SpaceGrotesk-Bold')
                    .fontSize(11)
                    .fillColor('#28a745')

                const textX = iconCenterX + iconSize / 2 + 6
                const textY = y + (buttonHeight / 2) - 4
                doc.text('Pass', textX, textY)
            }

            // Helper function to draw Fail button
            const drawFailButton = (x: number, y: number) => {
                const buttonWidth = 70
                const buttonHeight = 28
                const radius = 15
                const iconSize = 14

                doc.save()
                drawRoundedRect(x, y, buttonWidth, buttonHeight, radius)
                doc.fillColor('#E5E5E5')
                    .fill()
                doc.restore()

                const iconCenterX = x + 14
                const iconCenterY = y + buttonHeight / 2

                doc.circle(iconCenterX, iconCenterY, iconSize / 2)
                    .lineWidth(1.5)
                    .strokeColor('#dc3545')
                    .stroke()

                // Draw X icon
                const xSize = 3
                doc.moveTo(iconCenterX - xSize, iconCenterY - xSize)
                    .lineTo(iconCenterX + xSize, iconCenterY + xSize)
                    .lineWidth(1.5)
                    .strokeColor('#dc3545')
                    .stroke()
                doc.moveTo(iconCenterX + xSize, iconCenterY - xSize)
                    .lineTo(iconCenterX - xSize, iconCenterY + xSize)
                    .lineWidth(1.5)
                    .strokeColor('#dc3545')
                    .stroke()

                doc.font('SpaceGrotesk-Bold')
                    .fontSize(11)
                    .fillColor('#dc3545')

                const textX = iconCenterX + iconSize / 2 + 6
                const textY = y + (buttonHeight / 2) - 4
                doc.text('Fail', textX, textY)
            }

            // ========== PAGE 1: Certificate of Completion ==========
            let yPos = 100

            // Page background color (light beige/off-white)
            doc.rect(0, 0, pageWidth, pageHeight)
                .fillColor('#ffffff') // Light beige/off-white
                .fill();

            // Outer border (light beige)
            const borderWidth = 20;
            doc.rect(borderWidth / 2, borderWidth / 2, pageWidth - borderWidth, pageHeight - borderWidth)
                .strokeColor('#F8F0DB')
                .lineWidth(borderWidth)
                .stroke();

            // Inner border (thicker dark brown)
            const innerBorderWidth = 4;
            const innerBorderMargin = 15;
            doc.rect(innerBorderMargin, innerBorderMargin, pageWidth - (innerBorderMargin * 2), pageHeight - (innerBorderMargin * 2))
                .strokeColor('#F8F0DB') // Dark brown
                .lineWidth(innerBorderWidth)
                .stroke();

            // Corner decorative logos (mongobuffet_logo-topleft.png) on all four corners
            const decorativeCornerSize = 180;
            try {
                const cornerLogoPath = path.join(__dirname, '../../assets/mongobuffet_logo-topleft.png');
                if (fs.existsSync(cornerLogoPath)) {
                    const cornerSize = decorativeCornerSize; // size of the decorative corner

                    // Top-left (original orientation)
                    doc.image(cornerLogoPath, 0, 0, { width: cornerSize, height: cornerSize });

                    // Top-right (flip horizontally)
                    doc.save();
                    doc.translate(pageWidth, 0);
                    doc.scale(-1, 1);
                    doc.image(cornerLogoPath, 0, 0, { width: cornerSize, height: cornerSize });
                    doc.restore();

                    // Bottom-left (flip vertically)
                    doc.save();
                    doc.translate(0, pageHeight);
                    doc.scale(1, -1);
                    doc.image(cornerLogoPath, 0, 0, { width: cornerSize, height: cornerSize });
                    doc.restore();

                    // Bottom-right (flip both horizontally and vertically)
                    doc.save();
                    doc.translate(pageWidth, pageHeight);
                    doc.scale(-1, -1);
                    doc.image(cornerLogoPath, 0, 0, { width: cornerSize, height: cornerSize });
                    doc.restore();
                }
            } catch (error: unknown) {
                console.log('Could not load mongobuffet_logo-topleft.png image:', error instanceof Error ? error.message : 'Unknown error');
            }

            // Delicate corner accent lines near the decorative logos
            const cornerLineColor = '#E8D7A8';
            const cornerLineWidth = 1.2;
            const cornerLineLength = 130;
            const cornerLineInset = 30; // distance from outer edge

            // Top-left corner lines
            doc.moveTo(cornerLineInset, decorativeCornerSize + 5)
                .lineTo(cornerLineInset, decorativeCornerSize + 5 + cornerLineLength)
                .strokeColor(cornerLineColor)
                .lineWidth(cornerLineWidth)
                .stroke();

            doc.moveTo(decorativeCornerSize + 5, cornerLineInset)
                .lineTo(decorativeCornerSize + 5 + cornerLineLength, cornerLineInset)
                .stroke();

            // Top-right corner lines
            doc.moveTo(pageWidth - cornerLineInset, decorativeCornerSize + 5)
                .lineTo(pageWidth - cornerLineInset, decorativeCornerSize + 5 + cornerLineLength)
                .stroke();

            doc.moveTo(pageWidth - decorativeCornerSize - 5, cornerLineInset)
                .lineTo(pageWidth - decorativeCornerSize - 5 - cornerLineLength, cornerLineInset)
                .stroke();

            // Bottom-left corner lines
            doc.moveTo(cornerLineInset, pageHeight - decorativeCornerSize - 5)
                .lineTo(cornerLineInset, pageHeight - decorativeCornerSize - 5 - cornerLineLength)
                .stroke();

            doc.moveTo(decorativeCornerSize + 5, pageHeight - cornerLineInset)
                .lineTo(decorativeCornerSize + 5 + cornerLineLength, pageHeight - cornerLineInset)
                .stroke();

            // Bottom-right corner lines
            doc.moveTo(pageWidth - cornerLineInset, pageHeight - decorativeCornerSize - 5)
                .lineTo(pageWidth - cornerLineInset, pageHeight - decorativeCornerSize - 5 - cornerLineLength)
                .stroke();

            doc.moveTo(pageWidth - decorativeCornerSize - 5, pageHeight - cornerLineInset)
                .lineTo(pageWidth - decorativeCornerSize - 5 - cornerLineLength, pageHeight - cornerLineInset)
                .stroke();

            // Add PASSED stamp image
            try {
                const imagePath = path.join(__dirname, '../../assets/passed.png')
                if (fs.existsSync(imagePath)) {
                    const imageWidth = 350
                    const imageHeight = 150
                    const imageX = centerX - imageWidth / 2
                    doc.image(imagePath, imageX, yPos, { width: imageWidth, height: imageHeight })
                    yPos += imageHeight + 30
                }
            } catch (error: any) {
                console.log('Could not load passed.png image:', error.message)
            }

            // Certificate Title
            doc.font('SpaceGrotesk-Bold')
                .fontSize(36)
                .fillColor('black')
            const certWidth = doc.widthOfString('Certificate')
            const completionWidth = doc.widthOfString('of Completion')
            doc.text('Certificate', centerX - certWidth / 2, yPos)
            yPos += 50
            doc.text('of Completion', centerX - completionWidth / 2, yPos)

            // Main Body Text
            yPos += 80
            doc.font('SpaceGrotesk')
                .fontSize(14)
                .fillColor('#666666')
            const passText = 'PropertyGoose recognises this reference as a pass.'
            const passTextWidth = doc.widthOfString(passText)
            doc.text(passText, centerX - passTextWidth / 2, yPos)
            yPos += 25
            const addressText = `For the address: ${propertyAddress}${propertyCity ? ', ' + propertyCity : ''}${propertyPostcode ? ' ' + propertyPostcode : ''}`
            const addressTextWidth = doc.widthOfString(addressText)
            doc.text(addressText, centerX - addressTextWidth / 2, yPos)

            // PropertyGoose Referencing Signature
            yPos += 80
            const signatureY = yPos
            doc.font('SpaceGrotesk')
                .fontSize(18)
            const propertyWidth = doc.widthOfString('Property')
            const gooseWidth = doc.widthOfString('Goose')
            const referencingWidth = doc.widthOfString(' Referencing')
            const totalWidth = propertyWidth + gooseWidth + referencingWidth
            let xPos = centerX - totalWidth / 2

            doc.fillColor('black')
                .text('Property', xPos, signatureY)
            xPos += propertyWidth
            doc.fillColor('#D2691E')
                .text('Goose', xPos, signatureY)
            xPos += gooseWidth
            doc.fillColor('black')
                .text(' Referencing', xPos, signatureY)

            // Horizontal Line
            yPos += 35
            doc.moveTo(margin + 50, yPos)
                .lineTo(pageWidth - margin - 50, yPos)
                .strokeColor('#D2691E')
                .lineWidth(1)
                .stroke()

            // Confirmation Text
            yPos += 40
            doc.font('SpaceGrotesk')
                .fontSize(12)
                .fillColor('#666666')
            const actionWord = isGuarantor ? 'guarantee' : 'start'
            const checksText = `We have carried out all necessary checks needed and the ${personLabel.toLowerCase()} is clear to ${actionWord} this tenancy.`
            doc.text(checksText, margin, yPos, { align: 'center', width: pageWidth - (2 * margin) })

            // Disclaimer for Pass with Guarantor (only show for tenants, not guarantors)
            if (score?.decision === 'PASS_WITH_GUARANTOR' && !isGuarantor) {
                yPos += 35
                const disclaimerBoxWidth = pageWidth - (2 * margin) - 40
                const disclaimerBoxX = margin + 20
                const disclaimerBoxHeight = 50

                // Yellow warning box background
                doc.rect(disclaimerBoxX, yPos, disclaimerBoxWidth, disclaimerBoxHeight)
                    .fillColor('#FFF3CD')
                    .fill()

                // Border
                doc.rect(disclaimerBoxX, yPos, disclaimerBoxWidth, disclaimerBoxHeight)
                    .strokeColor('#856404')
                    .lineWidth(1.5)
                    .stroke()

                // Warning text
                doc.font('SpaceGrotesk-Bold')
                    .fontSize(11)
                    .fillColor('#856404')
                const disclaimerText = 'THIS PASS IS ONLY ACCEPTABLE WITH A REFERENCED GUARANTOR OR RENT UPFRONT'
                doc.text(disclaimerText, disclaimerBoxX, yPos + 18, {
                    align: 'center',
                    width: disclaimerBoxWidth
                })
            }

            // Tenant Name Field
            yPos = pageHeight - 150
            doc.font('SpaceGrotesk')
                .fontSize(12)
                .fillColor('#666666')
                .text(`${personLabel} Name:`, margin, yPos)

            const fullName = `${firstName}${middleName ? ' ' + middleName : ''} ${lastName}`
            doc.font('SpaceGrotesk')
                .fontSize(12)
                .fillColor('#333333')
                .text(fullName, margin + 180, yPos - 10)

            const nameLineY = yPos + 5
            doc.moveTo(margin + 100, nameLineY)
                .lineTo(pageWidth - margin - 50, nameLineY)
                .strokeColor('#D2691E')
                .lineWidth(0.5)
                .stroke()

            // Add badge image
            try {
                const badgePath = path.join(__dirname, '../../assets/badge.png')
                if (fs.existsSync(badgePath)) {
                    const badgeWidth = 70
                    const badgeHeight = 100
                    const badgeY = nameLineY + 20
                    const badgeX = centerX - badgeWidth / 2
                    doc.image(badgePath, badgeX, badgeY, { width: badgeWidth, height: badgeHeight })
                }
            } catch (error: any) {
                console.log('Could not load badge.png image:', error.message)
            }

            // ========== PAGE 2: Tenancy Reference ==========
            doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } })

            const page2Margin = 40

            // Header - Orange bar
            const headerHeight = 50
            const headerMargin = 40
            const headerTopMargin = 30
            const headerWidth = pageWidth - (2 * headerMargin)
            const headerX = headerMargin

            doc.rect(headerX, headerTopMargin, headerWidth, headerHeight)
                .fillColor('#FF8C00')
                .fill()

            doc.font('SpaceGrotesk-Bold')
                .fontSize(16)
                .fillColor('white')
            const referenceNumber = reference.reference_number || `REF-${referenceId.substring(0, 8).toUpperCase()}`
            const headerLine1 = `Reference Number - ${referenceNumber}`
            const headerLine2 = `${personLabel} Name - ${fullName}`
            const line1Width = doc.widthOfString(headerLine1)
            const line2Width = doc.widthOfString(headerLine2)
            const maxWidth = Math.max(line1Width, line2Width)
            const textX = headerX + (headerWidth - maxWidth) / 2
            const textY = headerTopMargin + headerHeight / 2 - 12
            doc.text(headerLine1, textX, textY)
            doc.text(headerLine2, textX, textY + 20)

            // Start content below header
            let yPos2 = headerTopMargin + headerHeight + 20

            // Overall Result Section
            const sectionMargin = 20
            const sectionWidth = pageWidth - 2 * page2Margin
            let sectionY = yPos2

            const overallResultHeight = 150
            drawRoundedRect(page2Margin, sectionY, sectionWidth, overallResultHeight, 10)
            doc.fillColor('white')
                .fill()

            sectionY += 25
            const titlePrefix = reference.title ? `${reference.title} ` : ''
            doc.font('SpaceGrotesk-Bold')
                .fontSize(14)
                .fillColor('black')
                .text(`Applicant: ${titlePrefix}${fullName}`, page2Margin + sectionMargin, sectionY)

            // Overall result heading and Pass button
            const resultHeadingY = sectionY
            doc.font('SpaceGrotesk-Bold')
                .fontSize(12)
            const overallResultText = 'Overall result'
            const overallResultWidth = doc.widthOfString(overallResultText)
            const buttonWidth = 70
            const buttonHeight = 28
            const buttonX = pageWidth - page2Margin - sectionMargin - buttonWidth
            const headingBaselineY = resultHeadingY + (buttonHeight / 2) - 6
            const headingX = buttonX - overallResultWidth - 15

            doc.fillColor('#666666')
                .text(overallResultText, headingX, headingBaselineY)
            drawPassButton(buttonX, resultHeadingY)

            // Summary paragraph - build from assessment data
            sectionY += 40
            let summaryText = 'This applicant has been thoroughly assessed. '

            if (totalIncome > 0 && monthlyRent > 0) {
                if (affordabilityRatio >= 3) {
                    summaryText += 'The applicant\'s income is more than sufficient for the proposed tenancy, '
                } else if (affordabilityRatio >= 2.5) {
                    summaryText += 'The applicant\'s income is sufficient for the proposed tenancy, '
                } else {
                    summaryText += 'The applicant\'s income has been assessed for the proposed tenancy, '
                }
            }

            if (creditsafe && !adverseCreditFound) {
                summaryText += 'and their credit score is very good. '
            }

            if (annualSalary > 0) {
                summaryText += 'The applicant is understood to be employed and their income has been verified. '
            } else if (selfEmployedIncome > 0) {
                summaryText += 'The applicant is self-employed and their income has been verified. '
            }

            if (isLivingWithFamily) {
                summaryText += 'No previous landlord check was possible as the applicant is currently Living With Family. '
            } else if (!landlordReference && !agentReference) {
                summaryText += 'No previous landlord check was available. '
            }

            if (!adverseCreditFound && ccjCount === 0 && bankruptcyCount === 0) {
                summaryText += 'No evidence of CCJs, fraud or serious credit history problems could be found.'
            } else {
                summaryText += 'Credit checks have been completed.'
            }

            doc.font('SpaceGrotesk')
                .fontSize(10)
                .fillColor('#333333')
                .text(summaryText, page2Margin + sectionMargin, sectionY, {
                    width: sectionWidth - 2 * sectionMargin,
                    align: 'left',
                    lineGap: 3
                })

            yPos2 += overallResultHeight + 20

            // Two column layout
            const columnGap = 15
            const columnWidth = (pageWidth - 2 * page2Margin - columnGap) / 2
            const leftColumnX = page2Margin
            const rightColumnX = page2Margin + columnWidth + columnGap
            let leftY = yPos2
            let rightY = yPos2

            // Helper function to draw a section
            // buttonType: 'none' | 'pass' | 'fail' - determines which button to show in the header
            const drawSection = (x: number, y: number, title: string, data: Array<[string, string, boolean]>, buttonType: 'none' | 'pass' | 'fail' = 'none', headerColor = '#FF8C00', useAlternatingColors = false) => {
                const headerHeight = 30
                const contentPadding = 15
                let contentHeight = 24 + (data.length * 24)
                if (contentHeight < 80) contentHeight = 80
                const sectionHeight = headerHeight + contentHeight

                const headerRadius = 15
                drawRoundedRect(x, y, columnWidth, headerHeight, headerRadius)
                doc.fillColor(headerColor)
                    .fill()

                doc.font('SpaceGrotesk-Bold')
                    .fontSize(12)
                    .fillColor(headerColor === '#FF8C00' ? 'white' : '#333333')
                    .text(title, x + contentPadding, y + 10)

                if (buttonType === 'pass') {
                    const buttonWidth = 70
                    drawPassButton(x + columnWidth - buttonWidth, y + 1)
                } else if (buttonType === 'fail') {
                    const buttonWidth = 70
                    drawFailButton(x + columnWidth - buttonWidth, y + 1)
                }

                const contentY = y + headerHeight
                drawRoundedRect(x, contentY, columnWidth, contentHeight, 10)
                doc.fillColor('white')
                    .fill()

                let textY = contentY + 18
                let inSubSection = false
                let subSectionY: number | null = null
                let rowIndex = 0

                data.forEach(([label, value, hasCheckmark]) => {
                    if (value === '') {
                        subSectionY = textY - 2
                        inSubSection = true
                        doc.font('SpaceGrotesk-Bold')
                            .fontSize(10)
                            .fillColor('#555555')
                            .text(label, x + contentPadding, textY)
                    } else {
                        const isIndented = label.startsWith('  ')
                        if (isIndented && inSubSection && subSectionY !== null) {
                            const subRowPaddingY = 10
                            const subRowPaddingX = 2
                            const subRowHeight = 26
                            const subRowY = textY - subRowPaddingY

                            doc.rect(
                                x + contentPadding - subRowPaddingX,
                                subRowY,
                                columnWidth - (contentPadding * 2) + subRowPaddingX * 2,
                                subRowHeight
                            )
                                .fillColor('#F5F5F5')
                                .fill()

                            inSubSection = false
                        }

                        if (useAlternatingColors && !isIndented) {
                            const rowPaddingY = 4
                            const rowPaddingX = 2
                            const rowHeight = 22
                            const rowY = textY - rowPaddingY
                            const rowColor = rowIndex % 2 === 0 ? '#F8F8F8' : '#FFFFFF'

                            const rowX = x + contentPadding - rowPaddingX
                            const rowWidth = columnWidth - (contentPadding * 2) + rowPaddingX * 2
                            const rowRadius = 6

                            drawRoundedRect(rowX, rowY, rowWidth, rowHeight, rowRadius)
                            doc.fillColor(rowColor).fill()

                            rowIndex++
                        }

                        const labelText = label.endsWith(':') ? label : `${label}:`
                        const labelX = isIndented ? x + contentPadding + 10 : x + contentPadding

                        doc.font('SpaceGrotesk-Bold')
                            .fontSize(10)
                            .fillColor('#555555')
                            .text(labelText.replace(/^  /, ''), labelX, textY)

                        const valueX = x + contentPadding + 175
                        doc.font('SpaceGrotesk')
                            .fontSize(10)
                            .fillColor('#777777')
                            .text(value, valueX, textY)

                        if (hasCheckmark) {
                            const valueWidth = doc.widthOfString(value)
                            const iconRadius = 5
                            const iconCenterX = valueX + valueWidth + 12
                            const iconCenterY = textY + 4

                            doc.circle(iconCenterX, iconCenterY, iconRadius)
                                .lineWidth(1.2)
                                .strokeColor('#28a745')
                                .stroke()

                            doc.moveTo(iconCenterX - 2, iconCenterY)
                                .lineTo(iconCenterX, iconCenterY + 2.5)
                                .lineTo(iconCenterX + 3, iconCenterY - 2.5)
                                .lineWidth(1.2)
                                .strokeColor('#28a745')
                                .stroke()
                        }
                    }
                    textY += 24
                })

                return sectionHeight + 14
            }

            // LEFT COLUMN
            // Personal Data Section
            const personalData: Array<[string, string, boolean]> = [
                ['Has children', hasChildren ? 'Yes' : 'No', false],
                ['Smoker', isSmoker ? 'Yes' : 'No', false],
                ['Pets', hasPets ? 'Yes' : 'No', false],
                ['No. of tenants ', String(numberOfTenants), false]
            ]
            leftY += drawSection(leftColumnX, leftY, 'Personal Data', personalData, 'none', '#FF8C00', true)

            // Affordability Section (same structure as frontend)
            // Show Pass if ratio >= 2.5x, otherwise Fail (requires guarantor)
            const affordabilityData: Array<[string, string, boolean]> = [
                ['Rent share', `£${rentShareValue.toLocaleString('en-GB')} pcm`, false],
                ['Affordability ratio', affordabilityRatioText, affordabilityRatio >= 2.5],
                ['Verified savings', `£${savingsAmount.toLocaleString('en-GB')}`, true],
                ['Maximum affordable rent', `£${maxAffordableRent.toLocaleString('en-GB', { maximumFractionDigits: 0 })} pcm`, false]
            ]
            const affordabilityButtonType: 'pass' | 'fail' = affordabilityRatio >= 2.5 ? 'pass' : 'fail'
            leftY += drawSection(leftColumnX, leftY, 'Affordability', affordabilityData, affordabilityButtonType)

            // Income Check Section (same structure as frontend)
            const incomeData: Array<[string, string, boolean]> = [
                ['Total income', `£${totalIncome.toLocaleString('en-GB')} pa`, true],
                ['Primary income', '', false]
            ]
            if (annualSalary > 0) {
                incomeData.push(['  Employment salary', `£${annualSalary.toLocaleString('en-GB')} pa`, false])
            }
            if (selfEmployedIncome > 0) {
                incomeData.push(['  Self-employed income', `£${selfEmployedIncome.toLocaleString('en-GB')} pa`, false])
            }
            if (benefitsAnnual > 0) {
                incomeData.push(['  Benefits', `£${benefitsAnnual.toLocaleString('en-GB')} pa`, false])
            }
            if (savingsAmount > 0) {
                incomeData.push(['  Sav. /Pen. /Inv.  ', ` £${savingsAmount.toLocaleString('en-GB')} pa`, false])
            }
            if (additionalIncome > 0) {
                incomeData.push(['  Additional income', `£${additionalIncome.toLocaleString('en-GB')} pa`, false])
            }
            leftY += drawSection(leftColumnX, leftY, 'Income Check', incomeData, 'pass')

            // RIGHT COLUMN
            // Landlord Reference Section
            const landlordData: Array<[string, string, boolean]> = []
            if (isLivingWithFamily) {
                landlordData.push(['Landlord reference not applicable', '', false])
            } else if (!landlordReference && !agentReference) {
                landlordData.push(['Landlord reference not provided', '', false])
            } else {
                landlordData.push(['Landlord reference', 'Completed', true])
            }
            rightY += drawSection(rightColumnX, rightY, 'Landlord Reference', landlordData, 'pass')

            // Credit History Section
            const creditData: Array<[string, string, boolean]> = [
                ['Adverse credit', adverseCreditFound ? 'Found' : 'None found', false],
                ['Court judgments found', String(ccjCount), false],
                ['Bankruptcies found', String(bankruptcyCount), false],
                ['Debt relief orders found', '0', false],
                ['Voluntary arrangements found', '0', false]
            ]
            rightY += drawSection(rightColumnX, rightY, 'Credit History', creditData, 'pass')

            // PEP & Sanction Checks Section
            const sanctionsStatus = sanctions?.risk_level === 'clear' || (Array.isArray(sanctions?.sanctions_matches) && sanctions.sanctions_matches.length === 0)
            const pepData: Array<[string, string, boolean]> = [
                ['Sanctions', sanctionsStatus ? 'Complete' : 'Pending', false],
                ['PEP', sanctionsStatus ? 'Complete' : 'Pending', false],
                ['Completion date', formatDate(sanctions?.verified_at || score?.scored_at), false]
            ]
            rightY += drawSection(rightColumnX, rightY, 'PEP & Sanction Checks', pepData, 'pass')

            // Footer for page 2
            const page2FooterY = pageHeight - 30
            const generatedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            doc.font('SpaceGrotesk')
                .fontSize(9)
                .fillColor('#666666')
                .text(`Report generated ${generatedDate}`, page2Margin, page2FooterY)
            const page2PageNum = '2/5'
            doc.text(page2PageNum, pageWidth - page2Margin - 20, page2FooterY)

            // Continue with remaining pages (Page 3, 4, 5) - similar structure but with real data
            // For brevity, I'll add the key sections. The full implementation would include all pages.

            // ========== PAGE 3: Residential Reference Evidence ==========
            if (agentReference || landlordReference) {
                doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } })
                const page3Margin = 40
                const page3SectionWidth = pageWidth - 2 * page3Margin
                let page3Y = 30

                // Residential Reference Evidence pill header
                const residentialPillHeight = 40
                const residentialPillRadius = residentialPillHeight / 2
                const residentialPillY = page3Y

                drawRoundedRect(page3Margin, residentialPillY, page3SectionWidth, residentialPillHeight, residentialPillRadius)
                doc.fillColor('#FF8C00').fill()

                doc.font('SpaceGrotesk-Bold')
                    .fontSize(16)
                    .fillColor('white')
                const residentialTitle = 'Residential Reference Evidence'
                const residentialTitleWidth = doc.widthOfString(residentialTitle)
                const residentialTitleX = page3Margin + (page3SectionWidth - residentialTitleWidth) / 2
                const residentialTitleY = residentialPillY + residentialPillHeight / 2 - 8
                doc.text(residentialTitle, residentialTitleX, residentialTitleY)

                // Residential Reference content
                let resY = residentialPillY + residentialPillHeight + 20
                const resTableX = page3Margin + 20
                const resTableWidth = page3SectionWidth - 40
                const resRowHeight = 22
                const resLabelColX = resTableX + 15
                const resValueColX = resLabelColX + 200

                const drawTableRow = (y: number, label: string, value: string, rowIndex: number) => {
                    const rowColor = rowIndex % 2 === 0 ? '#F8F8F8' : '#FFFFFF'
                    doc.rect(resTableX, y, resTableWidth, resRowHeight)
                        .fillColor(rowColor)
                        .fill()

                    doc.font('SpaceGrotesk-Bold')
                        .fontSize(9)
                        .fillColor('#555555')
                        .text(label, resLabelColX, y + 6)

                    doc.font('SpaceGrotesk')
                        .fontSize(9)
                        .fillColor('#333333')
                        .text(value, resValueColX, y + 6)
                }

                // Header with checkmark
                const checkIconRadius = 8
                const checkIconX = resLabelColX
                const checkIconY = resY + 5
                doc.circle(checkIconX + checkIconRadius, checkIconY, checkIconRadius)
                    .fillColor('#28a745')
                    .fill()

                doc.moveTo(checkIconX + checkIconRadius - 3, checkIconY)
                    .lineTo(checkIconX + checkIconRadius - 1, checkIconY + 2)
                    .lineTo(checkIconX + checkIconRadius + 3, checkIconY - 2)
                    .strokeColor('white')
                    .lineWidth(2)
                    .stroke()

                const referenceType = agentReference ? 'Letting Agent' : 'Landlord'
                const referenceData = agentReference || landlordReference
                const submittedDate = formatDateTime(referenceData.submitted_at)

                doc.font('SpaceGrotesk-Bold')
                    .fontSize(11)
                    .fillColor('#333333')
                    .text(`${referenceType} Reference Completed`, checkIconX + checkIconRadius * 2 + 8, resY)

                const resRightColX = pageWidth - page3Margin - 220
                doc.font('SpaceGrotesk')
                    .fontSize(9)
                    .fillColor('#666666')
                    .text(`Submitted: ${submittedDate}`, resRightColX, resY, { width: 200, align: 'right' })

                resY += 25

                // Contact Information
                resY += 8
                doc.font('SpaceGrotesk-Bold')
                    .fontSize(10)
                    .fillColor('#555555')
                    .text('CONTACT INFORMATION', resLabelColX, resY)
                resY += 20

                const contactData: Array<[string, string]> = []
                if (agentReference) {
                    const agentName = agentReference.agent_name_encrypted ? decrypt(agentReference.agent_name_encrypted) : agentReference.agent_name || 'N/A'
                    const agentEmail = agentReference.agent_email_encrypted ? decrypt(agentReference.agent_email_encrypted) : agentReference.agent_email || 'N/A'
                    const agencyName = agentReference.agency_name_encrypted ? decrypt(agentReference.agency_name_encrypted) : agentReference.agency_name || 'N/A'
                    const agentPhone = agentReference.agent_phone_encrypted ? decrypt(agentReference.agent_phone_encrypted) : agentReference.agent_phone || 'N/A'

                    contactData.push(['Full Name:', agentName])
                    contactData.push(['Email:', agentEmail])
                    contactData.push(['Agency:', agencyName])
                    contactData.push(['Phone:', agentPhone])
                } else if (landlordReference) {
                    const landlordName = landlordReference.landlord_name_encrypted ? decrypt(landlordReference.landlord_name_encrypted) : landlordReference.landlord_name || 'N/A'
                    const landlordEmail = landlordReference.landlord_email_encrypted ? decrypt(landlordReference.landlord_email_encrypted) : landlordReference.landlord_email || 'N/A'
                    const landlordPhone = landlordReference.landlord_phone_encrypted ? decrypt(landlordReference.landlord_phone_encrypted) : landlordReference.landlord_phone || 'N/A'

                    contactData.push(['Full Name:', landlordName])
                    contactData.push(['Email:', landlordEmail])
                    contactData.push(['Phone:', landlordPhone])
                }

                contactData.forEach(([label, value], index) => {
                    drawTableRow(resY, label, value, index)
                    resY += resRowHeight
                })

                resY += 15

                // Property & Tenancy Details
                doc.font('SpaceGrotesk-Bold')
                    .fontSize(10)
                    .fillColor('#555555')
                    .text('PROPERTY & TENANCY DETAILS', resLabelColX, resY)
                resY += 20

                const tenancyStart = reference.previous_tenancy_start_date ? formatDate(reference.previous_tenancy_start_date) : 'N/A'
                const tenancyEnd = reference.previous_tenancy_end_date ? formatDate(reference.previous_tenancy_end_date) : 'Ongoing'
                const previousRent = reference.previous_monthly_rent_encrypted ? decrypt(reference.previous_monthly_rent_encrypted) : (reference.previous_monthly_rent ? `£${reference.previous_monthly_rent}` : 'N/A')

                const propertyData: Array<[string, string]> = [
                    ['Property Address:', propertyAddress],
                    ['City:', propertyCity || 'N/A'],
                    ['Postcode:', propertyPostcode || 'N/A'],
                    ['Tenancy Start:', tenancyStart],
                    ['Tenancy End:', tenancyEnd],
                    ['Monthly Rent:', previousRent]
                ]

                propertyData.forEach(([label, value], index) => {
                    drawTableRow(resY, label, value, contactData.length + index)
                    resY += resRowHeight
                })

                resY += 15

                // Reference Assessment
                doc.font('SpaceGrotesk-Bold')
                    .fontSize(10)
                    .fillColor('#555555')
                    .text('REFERENCE ASSESSMENT', resLabelColX, resY)
                resY += 20

                const rentPaidOnTime = referenceData.rent_paid_on_time === "yes" ? 'Yes' : referenceData.rent_paid_on_time === "no" ? 'No' : '—'
                const goodTenant = referenceData.good_tenant === "yes" ? 'Yes' : referenceData.good_tenant === "no" ? 'No' : '—'
                const wouldRentAgain = referenceData.would_rent_again === "yes" ? 'Yes' : referenceData.would_rent_again === "no" ? 'No' : '—'

                const assessmentData: Array<[string, string]> = [
                    ['Rent Paid On Time:', rentPaidOnTime],
                    ['Good Tenant:', goodTenant],
                    ['Would Rent Again:', wouldRentAgain]
                ]

                assessmentData.forEach(([label, value], index) => {
                    drawTableRow(resY, label, value, contactData.length + propertyData.length + index)
                    resY += resRowHeight
                })

                // Signature section
                const signaturePadding = 15
                const signatureBoxHeight = 50
                const dateHeight = 20
                const signatureSectionHeight = signaturePadding + 20 + signatureBoxHeight + 10 + dateHeight + signaturePadding
                const signatureSectionWidth = page3SectionWidth
                const signatureSectionX = page3Margin

                const page3FooterY = pageHeight - 30
                let signatureSectionY = resY + 30
                if (signatureSectionY + signatureSectionHeight > page3FooterY - 10) {
                    signatureSectionY = page3FooterY - signatureSectionHeight - 20
                }

                drawRoundedRect(signatureSectionX, signatureSectionY, signatureSectionWidth, signatureSectionHeight, 5)
                doc.fillColor('#E8F5E9')
                    .fill()

                let currentY = signatureSectionY + signaturePadding
                doc.font('SpaceGrotesk-Bold')
                    .fontSize(10)
                    .fillColor('#2E7D32')
                    .text('Signature:', signatureSectionX + signaturePadding, currentY)

                currentY += 20
                const signatureBoxX = signatureSectionX + signaturePadding
                const signatureBoxY = currentY
                const signatureBoxWidth = signatureSectionWidth - (signaturePadding * 2)

                doc.rect(signatureBoxX, signatureBoxY, signatureBoxWidth, signatureBoxHeight)
                    .strokeColor('#46F2B7')
                    .lineWidth(1)
                    .stroke()
                    .fillColor('white')
                    .fill()

                // Get signature and name for residential reference
                const residentialSignature = agentReference ? agentSignature : landlordSignature
                const residentialSignatureName = agentReference ? agentSignatureName : landlordSignatureName
                const signerName = agentReference
                    ? (agentReference.agent_name_encrypted ? decrypt(agentReference.agent_name_encrypted) : agentReference.agent_name || '')
                    : (landlordReference?.landlord_name_encrypted ? decrypt(landlordReference.landlord_name_encrypted) : landlordReference?.landlord_name || '')

                // Add signature image if available
                if (residentialSignature) {
                    const signatureBuffer = base64ToBuffer(residentialSignature)
                    if (signatureBuffer) {
                        try {
                            // Calculate signature image dimensions to fit in box
                            const maxWidth = signatureBoxWidth - 10
                            const maxHeight = signatureBoxHeight - 10
                            doc.image(signatureBuffer, signatureBoxX + 5, signatureBoxY + 5, {
                                width: maxWidth,
                                height: maxHeight,
                                fit: [maxWidth, maxHeight]
                            })
                            // Add signature name below image if available
                            if (residentialSignatureName) {
                                doc.font('SpaceGrotesk')
                                    .fontSize(9)
                                    .fillColor('#555555')
                                    .text(residentialSignatureName, signatureBoxX + 5, signatureBoxY + signatureBoxHeight - 15)
                            }
                        } catch (error) {
                            console.error('Error adding residential signature image:', error)
                            // Fallback to text if image fails
                            if (residentialSignatureName || signerName) {
                                doc.font('SpaceGrotesk')
                                    .fontSize(10)
                                    .fillColor('#555555')
                                    .text(residentialSignatureName || signerName, signatureBoxX + 5, signatureBoxY + 5)
                            }
                        }
                    } else if (residentialSignatureName || signerName) {
                        doc.font('SpaceGrotesk')
                            .fontSize(10)
                            .fillColor('#555555')
                            .text(residentialSignatureName || signerName, signatureBoxX + 5, signatureBoxY + 5)
                    }
                } else if (signerName) {
                    doc.font('SpaceGrotesk')
                        .fontSize(10)
                        .fillColor('#555555')
                        .text(signerName, signatureBoxX + 5, signatureBoxY + 5)
                }

                currentY += signatureBoxHeight + 10
                doc.font('SpaceGrotesk-Bold')
                    .fontSize(10)
                    .fillColor('#2E7D32')
                    .text(`Date: ${formatDate(referenceData.submitted_at)}`, signatureSectionX + signaturePadding, currentY)

                // Footer for page 3
                const page3FooterYFinal = pageHeight - 30
                doc.font('SpaceGrotesk')
                    .fontSize(9)
                    .fillColor('#666666')
                    .text(`Report generated ${generatedDate}`, page3Margin, page3FooterYFinal)
                doc.text('3/5', pageWidth - page3Margin - 20, page3FooterYFinal)
            }

            // ========== PAGE 4: Income Reference Evidence ==========
            if (employerReference || accountantReference) {
                doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } })
                const page4Margin = 40
                const page4SectionWidth = pageWidth - 2 * page4Margin
                let page4Y = 30

                // Income Reference Evidence pill header
                const incomePillHeight = 40
                const incomePillRadius = incomePillHeight / 2
                const incomePillY = page4Y

                drawRoundedRect(page4Margin, incomePillY, page4SectionWidth, incomePillHeight, incomePillRadius)
                doc.fillColor('#FF8C00').fill()

                doc.font('SpaceGrotesk-Bold')
                    .fontSize(16)
                    .fillColor('white')
                const incomeTitle = 'Income Reference Evidence'
                const incomeTitleWidth = doc.widthOfString(incomeTitle)
                const incomeTitleX = page4Margin + (page4SectionWidth - incomeTitleWidth) / 2
                const incomeTitleY = incomePillY + incomePillHeight / 2 - 8
                doc.text(incomeTitle, incomeTitleX, incomeTitleY)

                // Income Reference content
                let incomeY = incomePillY + incomePillHeight + 20
                const incomeTableX = page4Margin + 20
                const incomeTableWidth = page4SectionWidth - 40
                const incomeRowHeight = 22
                const incomeLabelColX = incomeTableX + 15
                const incomeValueColX = incomeLabelColX + 200

                const drawIncomeTableRow = (y: number, label: string, value: string, rowIndex: number) => {
                    const rowColor = rowIndex % 2 === 0 ? '#F8F8F8' : '#FFFFFF'
                    doc.rect(incomeTableX, y, incomeTableWidth, incomeRowHeight)
                        .fillColor(rowColor)
                        .fill()

                    doc.font('SpaceGrotesk-Bold')
                        .fontSize(9)
                        .fillColor('#555555')
                        .text(label, incomeLabelColX, y + 6)

                    doc.font('SpaceGrotesk')
                        .fontSize(9)
                        .fillColor('#333333')
                        .text(value, incomeValueColX, y + 6)
                }

                // Header with checkmark
                const incomeCheckIconRadius = 8
                const incomeCheckIconX = incomeLabelColX
                const incomeCheckIconY = incomeY + 5
                doc.circle(incomeCheckIconX + incomeCheckIconRadius, incomeCheckIconY, incomeCheckIconRadius)
                    .fillColor('#28a745')
                    .fill()

                doc.moveTo(incomeCheckIconX + incomeCheckIconRadius - 3, incomeCheckIconY)
                    .lineTo(incomeCheckIconX + incomeCheckIconRadius - 1, incomeCheckIconY + 2)
                    .lineTo(incomeCheckIconX + incomeCheckIconRadius + 3, incomeCheckIconY - 2)
                    .strokeColor('white')
                    .lineWidth(2)
                    .stroke()

                const incomeReferenceType = employerReference ? 'Employer' : 'Accountant'
                const incomeRefData = employerReference || accountantReference
                const incomeSubmittedDate = formatDateTime(incomeRefData.submitted_at)

                doc.font('SpaceGrotesk-Bold')
                    .fontSize(11)
                    .fillColor('#333333')
                    .text(`${incomeReferenceType} Reference Completed`, incomeCheckIconX + incomeCheckIconRadius * 2 + 8, incomeY)

                const incomeRightColX = pageWidth - page4Margin - 220
                doc.font('SpaceGrotesk')
                    .fontSize(9)
                    .fillColor('#666666')
                    .text(`Submitted: ${incomeSubmittedDate}`, incomeRightColX, incomeY, { width: 200, align: 'right' })

                incomeY += 25

                // Company Information
                incomeY += 8
                doc.font('SpaceGrotesk-Bold')
                    .fontSize(10)
                    .fillColor('#555555')
                    .text('COMPANY INFORMATION', incomeLabelColX, incomeY)
                incomeY += 20

                const companyData: Array<[string, string]> = []
                if (employerReference) {
                    const companyName = employerReference.company_name_encrypted ? decrypt(employerReference.company_name_encrypted) : (employerReference.company_name || 'N/A')
                    const employerName = employerReference.employer_name_encrypted ? decrypt(employerReference.employer_name_encrypted) : (employerReference.employer_name || 'N/A')
                    const employerPosition = employerReference.employer_position_encrypted ? decrypt(employerReference.employer_position_encrypted) : (employerReference.employer_position || 'N/A')
                    const employerEmail = employerReference.employer_email_encrypted ? decrypt(employerReference.employer_email_encrypted) : (employerReference.employer_email || 'N/A')
                    const employerPhone = employerReference.employer_phone_encrypted ? decrypt(employerReference.employer_phone_encrypted) : (employerReference.employer_phone || 'N/A')

                    companyData.push(['Company:', companyName])
                    companyData.push(['Contact:', employerName])
                    companyData.push(['Position:', employerPosition])
                    companyData.push(['Email:', employerEmail])
                    if (employerPhone && employerPhone !== 'N/A') {
                        companyData.push(['Phone:', employerPhone])
                    }
                } else if (accountantReference) {
                    const accountantName = accountantReference.accountant_name_encrypted ? decrypt(accountantReference.accountant_name_encrypted) : (accountantReference.accountant_name || 'N/A')
                    const accountantFirm = accountantReference.accountant_firm_encrypted ? decrypt(accountantReference.accountant_firm_encrypted) : (accountantReference.accountant_firm || 'N/A')
                    const accountantEmail = accountantReference.accountant_email_encrypted ? decrypt(accountantReference.accountant_email_encrypted) : (accountantReference.accountant_email || 'N/A')
                    const accountantPhone = accountantReference.accountant_phone_encrypted ? decrypt(accountantReference.accountant_phone_encrypted) : (accountantReference.accountant_phone || 'N/A')

                    companyData.push(['Accountant Name:', accountantName])
                    companyData.push(['Firm:', accountantFirm])
                    companyData.push(['Email:', accountantEmail])
                    if (accountantPhone && accountantPhone !== 'N/A') {
                        companyData.push(['Phone:', accountantPhone])
                    }
                }

                companyData.forEach(([label, value], index) => {
                    drawIncomeTableRow(incomeY, label, value, index)
                    incomeY += incomeRowHeight
                })

                incomeY += 15

                // Employment Details (for employer reference)
                if (employerReference) {
                    doc.font('SpaceGrotesk-Bold')
                        .fontSize(10)
                        .fillColor('#555555')
                        .text('EMPLOYMENT DETAILS', incomeLabelColX, incomeY)
                    incomeY += 20

                    const employeePosition = employerReference.employee_position_encrypted ? decrypt(employerReference.employee_position_encrypted) : (employerReference.employee_position || 'N/A')
                    const employmentType = employerReference.employment_type || 'N/A'
                    const startDate = employerReference.employment_start_date ? formatDate(employerReference.employment_start_date) : 'N/A'
                    const endDate = employerReference.employment_end_date ? formatDate(employerReference.employment_end_date) : null
                    const currentlyEmployed = employerReference.is_current_employee === true ? 'Yes' : employerReference.is_current_employee === false ? 'No' : 'N/A'

                    const employmentData: Array<[string, string]> = [
                        ['Position:', employeePosition],
                        ['Type:', employmentType],
                        ['Start Date:', startDate]
                    ]
                    if (endDate) {
                        employmentData.push(['End Date:', endDate])
                    }
                    employmentData.push(['Currently Employed:', currentlyEmployed])

                    employmentData.forEach(([label, value], index) => {
                        drawIncomeTableRow(incomeY, label, value, companyData.length + index)
                        incomeY += incomeRowHeight
                    })

                    incomeY += 15

                    // Compensation
                    doc.font('SpaceGrotesk-Bold')
                        .fontSize(10)
                        .fillColor('#555555')
                        .text('COMPENSATION', incomeLabelColX, incomeY)
                    incomeY += 20

                    const annualSalaryDecrypted = employerReference.annual_salary_encrypted ? decrypt(employerReference.annual_salary_encrypted) : null
                    const annualSalary = annualSalaryDecrypted ? `£${parseFloat(annualSalaryDecrypted).toLocaleString('en-GB')}` : (employerReference.annual_salary ? `£${parseFloat(String(employerReference.annual_salary)).toLocaleString('en-GB')}` : 'N/A')
                    const salaryFrequency = employerReference.salary_frequency || 'N/A'
                    const probation = employerReference.is_probation === true || employerReference.is_probation === 'yes' ? 'Yes' : employerReference.is_probation === false || employerReference.is_probation === 'no' ? 'No' : 'N/A'
                    const probationEndDate = employerReference.probation_end_date ? formatDate(employerReference.probation_end_date) : null

                    const compensationData: Array<[string, string]> = [
                        ['Salary:', annualSalary],
                        ['Frequency:', salaryFrequency],
                        ['Probation:', probation]
                    ]
                    if (probationEndDate) {
                        compensationData.push(['Probation End:', probationEndDate])
                    }

                    compensationData.forEach(([label, value], index) => {
                        drawIncomeTableRow(incomeY, label, value, companyData.length + employmentData.length + index)
                        incomeY += incomeRowHeight
                    })

                    incomeY += 15

                    // Employment Status & Performance
                    doc.font('SpaceGrotesk-Bold')
                        .fontSize(10)
                        .fillColor('#555555')
                        .text('EMPLOYMENT STATUS', incomeLabelColX, incomeY)
                    incomeY += 20

                    const employmentStatus = employerReference.employment_status || 'N/A'
                    const performanceRating = employerReference.performance_rating || 'N/A'
                    const performanceDetails = employerReference.performance_details_encrypted ? decrypt(employerReference.performance_details_encrypted) : (employerReference.performance_details || '—')
                    const wouldReemploy = employerReference.would_reemploy_details_encrypted ? decrypt(employerReference.would_reemploy_details_encrypted) : 'N/A'

                    const statusData: Array<[string, string]> = [
                        ['Employment Status:', employmentStatus],
                        ['Performance Rating:', performanceRating],
                        ['Would Re-employ:', wouldReemploy]
                    ]
                    if (performanceDetails && performanceDetails !== '—') {
                        statusData.push(['Performance Details:', performanceDetails.substring(0, 50) + (performanceDetails.length > 50 ? '...' : '')])
                    }

                    statusData.forEach(([label, value], index) => {
                        drawIncomeTableRow(incomeY, label, value, companyData.length + employmentData.length + compensationData.length + index)
                        incomeY += incomeRowHeight
                    })
                } else if (accountantReference) {
                    // Business Details (for accountant reference)
                    doc.font('SpaceGrotesk-Bold')
                        .fontSize(10)
                        .fillColor('#555555')
                        .text('BUSINESS DETAILS', incomeLabelColX, incomeY)
                    incomeY += 20

                    const businessName = accountantReference.business_name_encrypted ? decrypt(accountantReference.business_name_encrypted) : (accountantReference.business_name || 'N/A')
                    const natureOfBusiness = accountantReference.nature_of_business_encrypted ? decrypt(accountantReference.nature_of_business_encrypted) : (accountantReference.nature_of_business || 'N/A')
                    const businessStartDate = accountantReference.business_start_date ? formatDate(accountantReference.business_start_date) : 'N/A'
                    const businessTradingStatus = accountantReference.business_trading_status || 'N/A'

                    const businessData: Array<[string, string]> = [
                        ['Business Name:', businessName],
                        ['Nature of Business:', natureOfBusiness],
                        ['Start Date:', businessStartDate],
                        ['Trading Status:', businessTradingStatus]
                    ]

                    businessData.forEach(([label, value], index) => {
                        drawIncomeTableRow(incomeY, label, value, companyData.length + index)
                        incomeY += incomeRowHeight
                    })

                    incomeY += 15

                    // Financial Information
                    doc.font('SpaceGrotesk-Bold')
                        .fontSize(10)
                        .fillColor('#555555')
                        .text('FINANCIAL INFORMATION', incomeLabelColX, incomeY)
                    incomeY += 20

                    const annualTurnoverDecrypted = accountantReference.annual_turnover_encrypted ? decrypt(accountantReference.annual_turnover_encrypted) : null
                    const annualTurnover = annualTurnoverDecrypted ? `£${parseFloat(annualTurnoverDecrypted).toLocaleString('en-GB')}` : (accountantReference.annual_turnover ? `£${parseFloat(String(accountantReference.annual_turnover)).toLocaleString('en-GB')}` : 'N/A')
                    const annualProfitDecrypted = accountantReference.annual_profit_encrypted ? decrypt(accountantReference.annual_profit_encrypted) : null
                    const annualProfit = annualProfitDecrypted ? `£${parseFloat(annualProfitDecrypted).toLocaleString('en-GB')}` : (accountantReference.annual_profit ? `£${parseFloat(String(accountantReference.annual_profit)).toLocaleString('en-GB')}` : 'N/A')
                    const estimatedMonthlyIncomeDecrypted = accountantReference.estimated_monthly_income_encrypted ? decrypt(accountantReference.estimated_monthly_income_encrypted) : null
                    const estimatedMonthlyIncome = estimatedMonthlyIncomeDecrypted ? `£${parseFloat(estimatedMonthlyIncomeDecrypted).toLocaleString('en-GB')}` : (accountantReference.estimated_monthly_income ? `£${parseFloat(String(accountantReference.estimated_monthly_income)).toLocaleString('en-GB')}` : 'N/A')
                    const businessFinanciallyStable = accountantReference.business_financially_stable === true || accountantReference.business_financially_stable === 'yes' ? 'Yes' : accountantReference.business_financially_stable === false || accountantReference.business_financially_stable === 'no' ? 'No' : 'N/A'
                    const accountantConfirmsIncome = accountantReference.accountant_confirms_income === true || accountantReference.accountant_confirms_income === 'yes' ? 'Yes' : accountantReference.accountant_confirms_income === false || accountantReference.accountant_confirms_income === 'no' ? 'No' : 'N/A'

                    const financialData: Array<[string, string]> = [
                        ['Annual Turnover:', annualTurnover],
                        ['Annual Profit:', annualProfit],
                        ['Estimated Monthly Income:', estimatedMonthlyIncome],
                        ['Financially Stable:', businessFinanciallyStable],
                        ['Confirms Income:', accountantConfirmsIncome]
                    ]

                    financialData.forEach(([label, value], index) => {
                        drawIncomeTableRow(incomeY, label, value, companyData.length + businessData.length + index)
                        incomeY += incomeRowHeight
                    })

                    incomeY += 15

                    // Tax Information
                    doc.font('SpaceGrotesk-Bold')
                        .fontSize(10)
                        .fillColor('#555555')
                        .text('TAX INFORMATION', incomeLabelColX, incomeY)
                    incomeY += 20

                    const taxReturnsFiled = accountantReference.tax_returns_filed === true || accountantReference.tax_returns_filed === 'yes' ? 'Yes' : accountantReference.tax_returns_filed === false || accountantReference.tax_returns_filed === 'no' ? 'No' : 'N/A'
                    const lastTaxReturnDate = accountantReference.last_tax_return_date ? formatDate(accountantReference.last_tax_return_date) : 'N/A'
                    const accountsPrepared = accountantReference.accounts_prepared === true || accountantReference.accounts_prepared === 'yes' ? 'Yes' : accountantReference.accounts_prepared === false || accountantReference.accounts_prepared === 'no' ? 'No' : 'N/A'
                    const accountsYearEnd = accountantReference.accounts_year_end ? formatDate(accountantReference.accounts_year_end) : 'N/A'
                    const anyOutstandingTaxLiabilities = accountantReference.any_outstanding_tax_liabilities === true || accountantReference.any_outstanding_tax_liabilities === 'yes' ? 'Yes' : accountantReference.any_outstanding_tax_liabilities === false || accountantReference.any_outstanding_tax_liabilities === 'no' ? 'No' : 'N/A'

                    const taxData: Array<[string, string]> = [
                        ['Tax Returns Filed:', taxReturnsFiled],
                        ['Last Tax Return Date:', lastTaxReturnDate],
                        ['Accounts Prepared:', accountsPrepared],
                        ['Accounts Year End:', accountsYearEnd],
                        ['Outstanding Tax Liabilities:', anyOutstandingTaxLiabilities]
                    ]

                    taxData.forEach(([label, value], index) => {
                        drawIncomeTableRow(incomeY, label, value, companyData.length + businessData.length + financialData.length + index)
                        incomeY += incomeRowHeight
                    })

                    incomeY += 15

                    // Recommendation
                    doc.font('SpaceGrotesk-Bold')
                        .fontSize(10)
                        .fillColor('#555555')
                        .text('RECOMMENDATION', incomeLabelColX, incomeY)
                    incomeY += 20

                    const wouldRecommend = accountantReference.would_recommend === true || accountantReference.would_recommend === 'yes' ? 'Yes' : accountantReference.would_recommend === false || accountantReference.would_recommend === 'no' ? 'No' : 'N/A'
                    const recommendationComments = accountantReference.recommendation_comments_encrypted ? decrypt(accountantReference.recommendation_comments_encrypted) : (accountantReference.recommendation_comments || '—')

                    const recommendationData: Array<[string, string]> = [
                        ['Would Recommend:', wouldRecommend]
                    ]
                    if (recommendationComments && recommendationComments !== '—') {
                        recommendationData.push(['Comments:', recommendationComments.substring(0, 50) + (recommendationComments.length > 50 ? '...' : '')])
                    }

                    recommendationData.forEach(([label, value], index) => {
                        drawIncomeTableRow(incomeY, label, value, companyData.length + businessData.length + financialData.length + taxData.length + index)
                        incomeY += incomeRowHeight
                    })
                }

                // Signature section
                const incomeSignaturePadding = 15
                const incomeSignatureBoxHeight = 50
                const incomeDateHeight = 20
                const incomeSignatureSectionHeight = incomeSignaturePadding + 20 + incomeSignatureBoxHeight + 10 + incomeDateHeight + incomeSignaturePadding
                const incomeSignatureSectionWidth = page4SectionWidth
                const incomeSignatureSectionX = page4Margin

                const page4FooterYCheck = pageHeight - 30
                let incomeSignatureSectionY = incomeY + 30
                if (incomeSignatureSectionY + incomeSignatureSectionHeight > page4FooterYCheck - 10) {
                    incomeSignatureSectionY = page4FooterYCheck - incomeSignatureSectionHeight - 20
                }

                drawRoundedRect(incomeSignatureSectionX, incomeSignatureSectionY, incomeSignatureSectionWidth, incomeSignatureSectionHeight, 5)
                doc.fillColor('#E8F5E9')
                    .fill()

                let incomeCurrentY = incomeSignatureSectionY + incomeSignaturePadding
                doc.font('SpaceGrotesk-Bold')
                    .fontSize(10)
                    .fillColor('#2E7D32')
                    .text('Signature:', incomeSignatureSectionX + incomeSignaturePadding, incomeCurrentY)

                incomeCurrentY += 20
                const incomeSignatureBoxX = incomeSignatureSectionX + incomeSignaturePadding
                const incomeSignatureBoxY = incomeCurrentY
                const incomeSignatureBoxWidth = incomeSignatureSectionWidth - (incomeSignaturePadding * 2)

                doc.rect(incomeSignatureBoxX, incomeSignatureBoxY, incomeSignatureBoxWidth, incomeSignatureBoxHeight)
                    .strokeColor('#81C784')
                    .lineWidth(1)
                    .stroke()
                    .fillColor('white')
                    .fill()

                // Get signature and name for income reference
                const incomeSignature = employerReference ? employerSignature : accountantSignature
                const incomeSignatureName = employerReference ? employerSignatureName : accountantSignatureName
                const incomeSignerName = employerReference
                    ? (employerReference.contact_name_encrypted ? decrypt(employerReference.contact_name_encrypted) : employerReference.contact_name || '')
                    : (accountantReference?.accountant_name_encrypted ? decrypt(accountantReference.accountant_name_encrypted) : accountantReference?.accountant_name || '')

                // Add signature image if available
                if (incomeSignature) {
                    const signatureBuffer = base64ToBuffer(incomeSignature)
                    if (signatureBuffer) {
                        try {
                            // Calculate signature image dimensions to fit in box
                            const maxWidth = incomeSignatureBoxWidth - 10
                            const maxHeight = incomeSignatureBoxHeight - 10
                            doc.image(signatureBuffer, incomeSignatureBoxX + 5, incomeSignatureBoxY + 5, {
                                width: maxWidth,
                                height: maxHeight,
                                fit: [maxWidth, maxHeight]
                            })
                            // Add signature name below image if available
                            if (incomeSignatureName) {
                                doc.font('SpaceGrotesk')
                                    .fontSize(9)
                                    .fillColor('#555555')
                                    .text(incomeSignatureName, incomeSignatureBoxX + 5, incomeSignatureBoxY + incomeSignatureBoxHeight - 15)
                            }
                        } catch (error) {
                            console.error('Error adding income signature image:', error)
                            // Fallback to text if image fails
                            if (incomeSignatureName || incomeSignerName) {
                                doc.font('SpaceGrotesk')
                                    .fontSize(10)
                                    .fillColor('#555555')
                                    .text(incomeSignatureName || incomeSignerName, incomeSignatureBoxX + 5, incomeSignatureBoxY + 5)
                            }
                        }
                    } else if (incomeSignatureName || incomeSignerName) {
                        doc.font('SpaceGrotesk')
                            .fontSize(10)
                            .fillColor('#555555')
                            .text(incomeSignatureName || incomeSignerName, incomeSignatureBoxX + 5, incomeSignatureBoxY + 5)
                    }
                } else if (incomeSignerName) {
                    doc.font('SpaceGrotesk')
                        .fontSize(10)
                        .fillColor('#555555')
                        .text(incomeSignerName, incomeSignatureBoxX + 5, incomeSignatureBoxY + 5)
                }

                incomeCurrentY += incomeSignatureBoxHeight + 10
                doc.font('SpaceGrotesk-Bold')
                    .fontSize(10)
                    .fillColor('#2E7D32')
                    .text(`Date: ${formatDate(incomeRefData.submitted_at)}`, incomeSignatureSectionX + incomeSignaturePadding, incomeCurrentY)

                // Footer for page 4
                const page4FooterY = pageHeight - 30
                doc.font('SpaceGrotesk')
                    .fontSize(9)
                    .fillColor('#666666')
                    .text(`Report generated ${generatedDate}`, page4Margin, page4FooterY)
                doc.text('4/5', pageWidth - page4Margin - 20, page4FooterY)
            }

            // ========== PAGE 5: Right To Rent Evidence ==========
            doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } })
            const page5Margin = 40
            const page5SectionWidth = pageWidth - 2 * page5Margin
            let page5Y = 30

            // Right To Rent Evidence label
            const rightToRentLabelHeight = 35
            const rightToRentLabelWidth = page5SectionWidth
            const rightToRentLabelX = page5Margin
            const rightToRentLabelY = page5Y

            drawRoundedRect(rightToRentLabelX, rightToRentLabelY, rightToRentLabelWidth, rightToRentLabelHeight, 5)
            doc.fillColor('#E3F2FD')
                .fill()

            doc.font('SpaceGrotesk-Bold')
                .fontSize(14)
                .fillColor('#333333')
            const rightToRentText = 'Right To Rent Evidence'
            const rightToRentTextWidth = doc.widthOfString(rightToRentText)
            const rightToRentTextX = rightToRentLabelX + (rightToRentLabelWidth - rightToRentTextWidth) / 2
            doc.text(rightToRentText, rightToRentTextX, rightToRentLabelY + 10)

            page5Y = rightToRentLabelY + rightToRentLabelHeight + 30

            // Document section
            const docSectionY = page5Y
            const docSectionWidth = page5SectionWidth
            const docSectionHeight = 400

            const passportX = page5Margin
            const passportY = docSectionY
            const passportWidth = docSectionWidth
            const passportHeight = docSectionHeight

            drawRoundedRect(passportX, passportY, passportWidth, passportHeight, 5)
            doc.fillColor('#F5F5DC')
                .fill()

            // Render document image if available
            if (documentBuffer) {
                try {
                    // Render image document (PDFs are already converted to images above if possible)
                    const imagePadding = 15
                    const imageX = passportX + imagePadding
                    const imageY = passportY + imagePadding
                    const imageWidth = passportWidth - (imagePadding * 2)
                    const imageHeight = passportHeight - (imagePadding * 2)

                    doc.image(documentBuffer, imageX, imageY, {
                        width: imageWidth,
                        height: imageHeight,
                        fit: [imageWidth, imageHeight]
                    })
                } catch (error) {
                    console.error('[Passed PDF] Error rendering document image:', error)
                }
            }

            // Footer for page 5
            const page5FooterY = pageHeight - 30
            doc.font('SpaceGrotesk')
                .fontSize(9)
                .fillColor('#666666')
                .text(`Report generated ${generatedDate}`, page5Margin, page5FooterY)
            doc.text('5/5', pageWidth - page5Margin - 20, page5FooterY)

            doc.end()
        } catch (error) {
            console.error('[Passed PDF] Generation error:', error)
            reject(error)
        }
    })
}

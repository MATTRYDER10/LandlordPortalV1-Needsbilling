import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { BRAND_COLORS } from '../config/colors'

interface ConsentData {
  firstName: string
  middleName?: string
  lastName: string
  consentPrintedName: string
  consentAgreedDate: string
  consentSignature: string // Base64 image
}

export class PDFService {
  private readonly BRAND_COLOR = BRAND_COLORS.primary
  private readonly LOGO_PATH = path.join(__dirname, '../../assets/PropertyGooseIcon.png')

  /**
   * Generates a consent declaration PDF
   */
  async generateConsentPDF(data: ConsentData, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create a document
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50
          }
        })

        // Pipe the PDF to a file
        const writeStream = fs.createWriteStream(outputPath)
        doc.pipe(writeStream)

        // Add PropertyGoose branding with logo + text
        if (fs.existsSync(this.LOGO_PATH)) {
          // Add logo on the left
          doc.image(this.LOGO_PATH, 50, 40, { width: 50, height: 50 })

          // Add "Property" in dark gray
          doc
            .fontSize(24)
            .fillColor('#111827')
            .font('Helvetica-Bold')
            .text('Property', 110, 50, { continued: true })

          // Add "Goose" in orange
          doc
            .fillColor(this.BRAND_COLOR)
            .text('Goose', { continued: false })

          // Reset font
          doc.font('Helvetica')
        }

        // Add title
        doc
          .fontSize(24)
          .fillColor(this.BRAND_COLOR)
          .text('Referencing Consent Declaration', 50, 130, { align: 'center' })

        // Add date in the top right
        doc
          .fontSize(10)
          .fillColor('#666666')
          .text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 400, 50, { align: 'right' })

        // Add applicant name
        doc
          .fontSize(12)
          .fillColor('#333333')
          .text(`Applicant: ${data.firstName} ${data.middleName || ''} ${data.lastName}`.trim(), 50, 180)

        doc.moveDown(2)

        // Add declaration text
        const declarationTexts = [
          'I confirm that all of the information I have provided in this application form is accurate, and to the best of my knowledge true. I consent to all of the information provided being checked and confirmed by fair and lawful means, I understand this will involve Propertygoose Ltd contacting the referees supplied.',

          'I agree that Propertygoose Ltd will use the information I provide on this application form and any information acquired from relevant sources to process my application for tenancy/to become a Guarantor for a tenancy. I understand that this application and the results of the findings will be forwarded to the instructing letting agent and/or landlord and that this information may be accessed again in the future should I default on my rental payments or payments due as a Guarantor, apply for a new tenancy or if there is a complaint or legal challenge with significance to this process.',

          'I understand that Propertygoose Ltd will use the services of a credit referencing agency for the purposes of Tenant vetting, identity and anti-money laundering. I understand they will check the details held with this company, and that they will in turn keep a record of that search.',

          'I understand that the information I am providing in this application form is information as described in ground 17 of the Housing Act 1996, and if any information is found to be untrue then this will be grounds for termination of the tenancy.',

          'Propertygoose Ltd may also use or forward information to the Police or other law enforcement agencies to prevent or detect crime, such as fraud, or in other circumstances as permitted by law. All information will be treated as confidential and processed in accordance with The Data Protection Act (2018).',

          'I hereby give authorisation for my EMPLOYER/ACCOUNTANT/PENSION ADMINISTRATOR to provide details of my earnings and dates of employment to Propertygoose Ltd for the benefit of completing this application. It is an offence to misrepresent any information provided in this form.',

          'I hereby give authorisation for my LANDLORD/LETTING AGENT to provide details of my tenancy, including payment information to Propertygoose Ltd for the benefit of completing this application. It is an offence to misrepresent any information provided in this form.',

          'By entering/signing your name on this form and submitting the details you confirm you are in agreement to the above terms and conditions and the processing of sensitive personal information. We process and hold all information in accordance with the GDPR (General Data Protection Regulations) 2018.',

          'If you\'ve been asked to upload any supporting documentation you can do so above. You will need to upload a copy of your photo ID (Passport, Driving licence, European ID card), proof of residency (in the form or a recent bank statement or utility bill dated within the last 3 months) and copies of your last 3 months\' payslips (if applicable). This will help us to process your application promptly.',

          'For further information on how we process your data and our privacy policies please visit: https://propertygoose.co.uk/privacy-policy'
        ]

        doc.fontSize(10).fillColor('#333333')

        declarationTexts.forEach((text, index) => {
          doc.text(text, {
            align: 'justify',
            lineGap: 4
          })

          if (index < declarationTexts.length - 1) {
            doc.moveDown(1)
          }
        })

        doc.moveDown(2)

        // Add signature section
        doc
          .fontSize(12)
          .fillColor('#333333')
          .text('Signature Details:', { underline: true })

        doc.moveDown(0.5)

        // Add signature image if provided
        if (data.consentSignature) {
          try {
            // Remove the data URL prefix if present
            const base64Data = data.consentSignature.replace(/^data:image\/\w+;base64,/, '')
            const imageBuffer = Buffer.from(base64Data, 'base64')

            doc
              .fontSize(10)
              .text('Signature:', { continued: false })

            doc.moveDown(0.3)
            doc.image(imageBuffer, { width: 200, height: 80 })
            doc.moveDown(0.5)
          } catch (error) {
            console.error('Error adding signature image:', error)
            doc
              .fontSize(10)
              .text(`Signature: [Electronic signature provided]`)
            doc.moveDown(1)
          }
        }

        // Add applicant details
        doc
          .fontSize(10)
          .text(`Agreed On: ${new Date(data.consentAgreedDate).toLocaleDateString('en-GB')}`)
        doc.moveDown(0.5)

        doc.text(`Printed Name: ${data.consentPrintedName}`)

        // Add footer
        doc
          .fontSize(8)
          .fillColor('#999999')
          .text(
            'This document was generated electronically by PropertyGoose Ltd',
            50,
            doc.page.height - 80,
            { align: 'center' }
          )

        doc.text(
          `Generated on: ${new Date().toLocaleString('en-GB')}`,
          50,
          doc.page.height - 60,
          { align: 'center' }
        )

        // Finalize the PDF
        doc.end()

        writeStream.on('finish', () => {
          resolve()
        })

        writeStream.on('error', (error) => {
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
    })
  }
}

export default new PDFService()

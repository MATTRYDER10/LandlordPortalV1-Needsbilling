/**
 * Section 8 Notice (Form 3) DOCX Generation Service
 * Generates official Form 3 using the docx npm package
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Packer,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx'
import { S8_GROUNDS, S8Ground, formatDateUK } from '../data/section8Grounds'

export interface S8FormData {
  // Step 1 - Tenant Details
  tenantNames: string[]
  propertyAddress: {
    line1: string
    line2?: string
    town: string
    county?: string
    postcode: string
  }
  tenantEmail: string
  tenantPhone: string

  // Step 2 - Landlord Details
  landlordNames: string[]
  landlordAddress: {
    line1: string
    line2?: string
    town: string
    county?: string
    postcode: string
  }
  servedByAgent: boolean
  agentName?: string
  agentAddress?: {
    line1: string
    line2?: string
    town: string
    county?: string
    postcode: string
  }

  // Step 3 - Tenancy Details
  tenancyStartDate: string
  rentAmount: number
  rentFrequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'
  rentDueDay: string

  // Step 4 - Grounds
  selectedGroundIds: string[]
  serviceDate: string
  earliestCourtDate: string

  // Step 5 - Arrears (optional)
  arrearsRows?: Array<{
    period: string
    dueDate?: string
    amountDue: number
    amountPaid: number
    paidDate?: string
    balance: number
  }>
  totalArrears?: number
  arrearsNotes?: string

  // Step 6 - Ground Explanations
  groundExplanations: Record<string, string>

  // Step 7 - Service Details
  serviceMethod: 'email' | 'first_class_post' | 'personal_service' | 'email_and_post'
  emailServedTo?: string
  signatoryName: string
  signatoryCapacity: 'landlord' | 'agent' | 'joint_landlord'
}

function formatAddress(address: { line1: string; line2?: string; town: string; county?: string; postcode: string }): string {
  const parts = [address.line1]
  if (address.line2) parts.push(address.line2)
  parts.push(address.town)
  if (address.county) parts.push(address.county)
  parts.push(address.postcode)
  return parts.join(', ')
}

function getServiceMethodText(method: string): string {
  switch (method) {
    case 'email': return 'Email'
    case 'first_class_post': return 'First class post'
    case 'personal_service': return 'Personal service'
    case 'email_and_post': return 'Email and post'
    default: return method
  }
}

function getSignatoryCapacityText(capacity: string): string {
  switch (capacity) {
    case 'landlord': return 'Landlord'
    case 'agent': return 'Agent for the Landlord'
    case 'joint_landlord': return 'Joint Landlord'
    default: return capacity
  }
}

function getRentFrequencyText(frequency: string): string {
  switch (frequency) {
    case 'weekly': return 'weekly'
    case 'fortnightly': return 'fortnightly'
    case 'monthly': return 'monthly'
    case 'quarterly': return 'quarterly'
    case 'yearly': return 'yearly'
    default: return frequency
  }
}

export async function generateSection8Notice(data: S8FormData): Promise<Buffer> {
  const selectedGrounds = S8_GROUNDS.filter(g => data.selectedGroundIds.includes(g.id))
  const serviceDate = new Date(data.serviceDate)
  const earliestCourtDate = new Date(data.earliestCourtDate)

  // Find the longest notice period ground
  const longestGround = selectedGrounds.reduce((prev, curr) =>
    curr.noticePeriodDays > prev.noticePeriodDays ? curr : prev
  )

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 22, // 11pt
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1134, // 2cm
              right: 1134,
              bottom: 1134,
              left: 1134,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'FORM NO. 3',
                    bold: true,
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Page ',
                    size: 18,
                    color: '666666',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    color: '666666',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 18,
                    color: '666666',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 18,
                    color: '666666',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'NOTICE OF INTENTION TO BEGIN PROCEEDINGS FOR POSSESSION',
                bold: true,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'OF A PROPERTY IN ENGLAND LET ON AN ASSURED TENANCY',
                bold: true,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: 'OR AN ASSURED AGRICULTURAL OCCUPANCY',
                bold: true,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Housing Act 1988, section 8 as amended by section 151 of the Housing Act 1996',
                italics: true,
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: '(See also section 37 of the Housing Act 2004 amending section 8 of the Housing Act 1988)',
                italics: true,
                size: 18,
              }),
            ],
          }),

          // Section 1: Tenant Details
          new Paragraph({
            spacing: { before: 300, after: 200 },
            children: [
              new TextRun({
                text: '1. To:',
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: data.tenantNames.join(', '),
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 300 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: `of ${formatAddress(data.propertyAddress)}`,
                size: 22,
              }),
            ],
          }),

          // Section 2: Property Address
          new Paragraph({
            spacing: { before: 300, after: 200 },
            children: [
              new TextRun({
                text: '2. The landlord/licensor intends to apply to the court for an order requiring you to give up possession of:',
                bold: true,
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 300 },
            indent: { left: 720 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            },
            children: [
              new TextRun({
                text: formatAddress(data.propertyAddress),
                size: 22,
              }),
            ],
          }),

          // Section 3: Grounds
          new Paragraph({
            spacing: { before: 300, after: 200 },
            children: [
              new TextRun({
                text: '3. The landlord/licensor intends to seek possession on the following ground(s):',
                bold: true,
                size: 22,
              }),
            ],
          }),

          // List each selected ground with full statutory wording
          ...selectedGrounds.flatMap((ground, index) => [
            new Paragraph({
              spacing: { before: 300, after: 100 },
              shading: {
                fill: ground.type === 'mandatory' ? 'FEE2E2' : 'FEF3C7',
              },
              children: [
                new TextRun({
                  text: `${ground.number} — ${ground.title}`,
                  bold: true,
                  size: 22,
                }),
                new TextRun({
                  text: ground.type === 'mandatory' ? '  [MANDATORY]' : '  [DISCRETIONARY]',
                  bold: true,
                  size: 18,
                  color: ground.type === 'mandatory' ? 'DC2626' : 'D97706',
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 200 },
              indent: { left: 360 },
              children: [
                new TextRun({
                  text: 'Statutory wording:',
                  bold: true,
                  italics: true,
                  size: 20,
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 300 },
              indent: { left: 360 },
              border: {
                left: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
              },
              children: [
                new TextRun({
                  text: ground.statutoryWording,
                  size: 20,
                  italics: true,
                }),
              ],
            }),
          ]),

          // Section 4: Particulars/Explanations
          new Paragraph({
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: '4. Particulars of ground(s):',
                bold: true,
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Full particulars in support of each ground relied upon are set out below:',
                size: 22,
              }),
            ],
          }),

          // Ground explanations
          ...selectedGrounds.flatMap((ground) => {
            const explanation = data.groundExplanations[ground.id] || ''
            return [
              new Paragraph({
                spacing: { before: 200, after: 100 },
                children: [
                  new TextRun({
                    text: `${ground.number}:`,
                    bold: true,
                    size: 22,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 200 },
                indent: { left: 360 },
                children: [
                  new TextRun({
                    text: explanation,
                    size: 22,
                  }),
                ],
              }),
            ]
          }),

          // Arrears table if applicable
          ...(data.arrearsRows && data.arrearsRows.length > 0 ? [
            new Paragraph({
              spacing: { before: 300, after: 200 },
              children: [
                new TextRun({
                  text: 'Schedule of Rent Arrears:',
                  bold: true,
                  size: 22,
                }),
              ],
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: [
                    new TableCell({
                      shading: { fill: 'E5E7EB' },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Period', bold: true, size: 18 })] })],
                    }),
                    new TableCell({
                      shading: { fill: 'E5E7EB' },
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Due Date', bold: true, size: 18 })] })],
                    }),
                    new TableCell({
                      shading: { fill: 'E5E7EB' },
                      children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Due', bold: true, size: 18 })] })],
                    }),
                    new TableCell({
                      shading: { fill: 'E5E7EB' },
                      children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Paid', bold: true, size: 18 })] })],
                    }),
                    new TableCell({
                      shading: { fill: 'E5E7EB' },
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Paid Date', bold: true, size: 18 })] })],
                    }),
                    new TableCell({
                      shading: { fill: 'E5E7EB' },
                      children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Balance', bold: true, size: 18 })] })],
                    }),
                  ],
                }),
                ...data.arrearsRows.map(row => {
                  const dueDate = row.dueDate ? new Date(row.dueDate).toLocaleDateString('en-GB') : '-'
                  const paidDate = row.paidDate ? new Date(row.paidDate).toLocaleDateString('en-GB') : '-'
                  const isLate = row.dueDate && row.paidDate && new Date(row.paidDate) > new Date(row.dueDate)

                  return new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: row.period, size: 18 })] })],
                      }),
                      new TableCell({
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: dueDate, size: 18 })] })],
                      }),
                      new TableCell({
                        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `£${row.amountDue.toFixed(2)}`, size: 18 })] })],
                      }),
                      new TableCell({
                        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `£${row.amountPaid.toFixed(2)}`, size: 18 })] })],
                      }),
                      new TableCell({
                        shading: isLate ? { fill: 'FEF3C7' } : undefined,
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: paidDate, size: 18, color: isLate ? 'B45309' : undefined })] })],
                      }),
                      new TableCell({
                        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `£${row.balance.toFixed(2)}`, size: 18, bold: true })] })],
                      }),
                    ],
                  })
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      columnSpan: 5,
                      shading: { fill: 'FEE2E2' },
                      children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'TOTAL ARREARS:', bold: true, size: 20 })] })],
                    }),
                    new TableCell({
                      shading: { fill: 'FEE2E2' },
                      children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `£${(data.totalArrears || 0).toFixed(2)}`, bold: true, size: 20 })] })],
                    }),
                  ],
                }),
              ],
            }),
            ...(data.arrearsNotes ? [
              new Paragraph({
                spacing: { before: 200, after: 200 },
                children: [
                  new TextRun({
                    text: 'Payment history notes: ',
                    bold: true,
                    size: 20,
                  }),
                  new TextRun({
                    text: data.arrearsNotes,
                    size: 20,
                  }),
                ],
              }),
            ] : []),
          ] : []),

          // Section 5: Court Date Information
          new Paragraph({
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: '5. The court proceedings will not be begun until after:',
                bold: true,
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: formatDateUK(earliestCourtDate),
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 300 },
            indent: { left: 720 },
            border: {
              left: { style: BorderStyle.SINGLE, size: 6, color: '3B82F6' },
            },
            shading: { fill: 'EFF6FF' },
            children: [
              new TextRun({
                text: `This date is calculated using the ${longestGround.noticePeriodLabel} notice period required for ${longestGround.number} — the longest of the selected grounds. This ensures all grounds remain valid at the hearing date, as required by section 8(4A) of the Housing Act 1988.`,
                size: 20,
                italics: true,
              }),
            ],
          }),

          // Section 6: 12-month lapse warning
          new Paragraph({
            spacing: { before: 300, after: 200 },
            children: [
              new TextRun({
                text: '6. If your landlord does not apply to the court within 12 months of the date of service of this notice, the notice will lapse.',
                bold: true,
                size: 22,
              }),
            ],
          }),

          // Section 7: Landlord/Agent Details
          new Paragraph({
            spacing: { before: 300, after: 200 },
            children: [
              new TextRun({
                text: '7. Name and address of landlord/licensor:',
                bold: true,
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: data.landlordNames.join(', '),
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 300 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: formatAddress(data.landlordAddress),
                size: 22,
              }),
            ],
          }),

          // Agent details if applicable
          ...(data.servedByAgent && data.agentName ? [
            new Paragraph({
              spacing: { before: 200, after: 100 },
              children: [
                new TextRun({
                  text: 'Notice served by agent:',
                  bold: true,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 100 },
              indent: { left: 720 },
              children: [
                new TextRun({
                  text: data.agentName,
                  size: 22,
                }),
              ],
            }),
            ...(data.agentAddress ? [
              new Paragraph({
                spacing: { after: 300 },
                indent: { left: 720 },
                children: [
                  new TextRun({
                    text: formatAddress(data.agentAddress),
                    size: 22,
                  }),
                ],
              }),
            ] : []),
          ] : []),

          // Section 8: Signature Block
          new Paragraph({
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: '8. Signed:',
                bold: true,
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: '_______________________________________',
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: `Name: ${data.signatoryName}`,
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: `Capacity: ${getSignatoryCapacityText(data.signatoryCapacity)}`,
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: `Date: ${formatDateUK(serviceDate)}`,
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 300 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: `Method of service: ${getServiceMethodText(data.serviceMethod)}`,
                size: 22,
              }),
            ],
          }),

          // Tenant Information Section
          new Paragraph({
            spacing: { before: 400 },
            border: {
              top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            },
            children: [],
          }),
          new Paragraph({
            spacing: { before: 200, after: 200 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'IMPORTANT INFORMATION FOR TENANTS',
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 150 },
            children: [
              new TextRun({
                text: 'This is a notice that your landlord intends to seek possession of your home. You do not have to leave your home at this stage.',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 150 },
            children: [
              new TextRun({
                text: 'Your landlord must obtain a court order before they can evict you, and even then you may have defences to the claim.',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 150 },
            children: [
              new TextRun({
                text: 'You should seek housing advice immediately. Free and confidential help is available from:',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: '• Shelter — 0808 800 4444 (free, Monday to Friday 8am-8pm, weekends 9am-5pm)',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: '• Citizens Advice — www.citizensadvice.org.uk',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: '• Your local council\'s housing advice service',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 300 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: '• A solicitor (you may qualify for legal aid)',
                size: 20,
              }),
            ],
          }),

          // Footer disclaimer
          new Paragraph({
            spacing: { before: 300 },
            border: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
            children: [],
          }),
          new Paragraph({
            spacing: { before: 100 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Generated via PropertyGoose. Based on Housing Act 1988 Schedule 2 grounds valid pre-1 May 2026.',
                size: 16,
                color: '666666',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'This document does not constitute legal advice.',
                size: 16,
                color: '666666',
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  return buffer
}

/**
 * Generate filename for the Section 8 notice
 */
export function generateS8Filename(data: S8FormData): string {
  const tenantSurname = data.tenantNames[0]?.split(' ').pop() || 'Tenant'
  const postcode = data.propertyAddress.postcode.replace(/\s/g, '')
  const date = new Date().toISOString().split('T')[0]
  return `Section8_Notice_${tenantSurname}_${postcode}_${date}.docx`
}

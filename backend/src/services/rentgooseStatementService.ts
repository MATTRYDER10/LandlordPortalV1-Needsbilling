import PDFDocument from 'pdfkit'
import { supabase } from '../config/supabase'
import { decrypt } from './encryption'
import fs from 'fs'
import path from 'path'
import https from 'https'
import type { PayoutItem } from './rentgooseService'

function downloadImageToBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

export async function generateLandlordStatement(companyId: string, payout: PayoutItem): Promise<{ storagePath: string; pdfBuffer: Buffer }> {
  const { data: company } = await supabase
    .from('companies')
    .select('name_encrypted, address_encrypted, city_encrypted, postcode_encrypted, phone_encrypted, email_encrypted, logo_url, primary_color')
    .eq('id', companyId)
    .single()

  const companyName = (company?.name_encrypted ? decrypt(company.name_encrypted) : null) || 'PropertyGoose'
  const companyAddress = [
    company?.address_encrypted ? decrypt(company.address_encrypted) : null,
    company?.city_encrypted ? decrypt(company.city_encrypted) : null,
    company?.postcode_encrypted ? decrypt(company.postcode_encrypted) : null
  ].filter(Boolean).join(', ')
  const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) : ''
  const companyEmail = company?.email_encrypted ? decrypt(company.email_encrypted) : ''
  const primaryColor = company?.primary_color || '#f97316'

  let logoBuffer: Buffer | null = null
  if (company?.logo_url) {
    try { logoBuffer = await downloadImageToBuffer(company.logo_url) } catch { /* fallback below */ }
  }
  if (!logoBuffer) {
    const fallbackPath = path.join(__dirname, '../../assets/PropertyGooseIcon.png')
    if (fs.existsSync(fallbackPath)) logoBuffer = fs.readFileSync(fallbackPath)
  }

  const { data: landlord } = await supabase
    .from('landlords')
    .select('first_name_encrypted, last_name_encrypted, residential_address_line1_encrypted, residential_city_encrypted, residential_postcode_encrypted')
    .eq('id', payout.landlord_id)
    .single()

  const landlordFullName = landlord
    ? `${decrypt(landlord.first_name_encrypted) || ''} ${decrypt(landlord.last_name_encrypted) || ''}`.trim()
    : payout.landlord_name
  const landlordAddress = landlord
    ? [decrypt(landlord.residential_address_line1_encrypted), decrypt(landlord.residential_city_encrypted), decrypt(landlord.residential_postcode_encrypted)].filter(Boolean).join(', ')
    : ''

  const statementDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const propertyAddress = `${payout.property_address}, ${payout.property_postcode}`
  const includedCharges = payout.charges.filter(c => c.included)

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 50, right: 50 } })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const L = 50        // left margin
      const R = 545       // right edge (595 - 50)
      const W = R - L      // usable width
      const cDesc = L      // description column start
      const cNet = 340     // net column start
      const cVat = 405     // vat column start
      const cGross = 470   // gross column start
      const cW = 65        // number column width

      // --- HELPERS ---
      function sectionTitle(title: string) {
        doc.fontSize(11).fillColor(primaryColor).font('Helvetica-Bold')
        doc.text(title, L, doc.y, { width: W })
        doc.moveDown(0.4)
      }

      function tableHeader() {
        const y = doc.y
        doc.fontSize(7).fillColor('#9ca3af').font('Helvetica')
        doc.text('DESCRIPTION', L, y, { width: 280 })
        doc.text('NET', cNet, y, { width: cW, align: 'right' })
        doc.text('VAT', cVat, y, { width: cW, align: 'right' })
        doc.text('GROSS', cGross, y, { width: cW, align: 'right' })
        doc.y = y + 12
      }

      function tableRow(desc: string, net: string, vat: string, gross: string, bold = false) {
        const y = doc.y
        doc.fontSize(9).fillColor('#1f2937').font(bold ? 'Helvetica-Bold' : 'Helvetica')
        doc.text(desc, L, y, { width: 280 })
        const textEnd = doc.y
        doc.fontSize(9).fillColor('#1f2937').font(bold ? 'Helvetica-Bold' : 'Helvetica')
        doc.text(net, cNet, y, { width: cW, align: 'right' })
        doc.text(vat, cVat, y, { width: cW, align: 'right' })
        doc.text(gross, cGross, y, { width: cW, align: 'right' })
        doc.y = Math.max(textEnd, y + 13)
      }

      function separator() {
        doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke()
        doc.moveDown(0.6)
      }

      // === HEADER ===
      let hx = L
      if (logoBuffer) {
        try { doc.image(logoBuffer, L, 40, { width: 45, height: 45 }); hx = L + 55 } catch { /* skip */ }
      }
      doc.fontSize(16).fillColor(primaryColor).font('Helvetica-Bold').text(companyName, hx, 42)
      doc.fontSize(8).fillColor('#6b7280').font('Helvetica')
      if (companyAddress) doc.text(companyAddress, hx)
      if (companyPhone) doc.text(companyPhone, hx)
      if (companyEmail) doc.text(companyEmail, hx)
      doc.y = Math.max(doc.y, 92)

      // === TITLE ===
      doc.moveDown(0.8)
      doc.fontSize(18).fillColor(primaryColor).font('Helvetica-Bold').text('Rental Statement', L, doc.y, { width: W, align: 'center' })
      doc.moveDown(0.8)

      // === META GRID ===
      const my = doc.y
      doc.fontSize(7).fillColor('#9ca3af').font('Helvetica').text('LANDLORD', L, my)
      doc.fontSize(10).fillColor('#1f2937').font('Helvetica-Bold').text(landlordFullName, L, my + 12)
      if (landlordAddress) doc.fontSize(8).fillColor('#6b7280').font('Helvetica').text(landlordAddress, L, my + 24, { width: 240 })

      doc.fontSize(7).fillColor('#9ca3af').font('Helvetica').text('STATEMENT DATE', 310, my)
      doc.fontSize(10).fillColor('#1f2937').font('Helvetica-Bold').text(statementDate, 310, my + 12)

      doc.fontSize(7).fillColor('#9ca3af').font('Helvetica').text('PROPERTY', L, my + 44)
      doc.fontSize(10).fillColor('#1f2937').font('Helvetica-Bold').text(propertyAddress, L, my + 56, { width: 240 })

      doc.fontSize(7).fillColor('#9ca3af').font('Helvetica').text('PERIOD', 310, my + 44)
      doc.fontSize(10).fillColor('#1f2937').font('Helvetica-Bold').text(`${fmtDate(payout.period_start)} to ${fmtDate(payout.period_end)}`, 310, my + 56)

      doc.y = my + 80
      doc.moveDown(0.5)
      separator()

      // === INCOME ===
      sectionTitle('Income')
      tableHeader()
      tableRow(
        `Rent for ${fmtDate(payout.period_start)} - ${fmtDate(payout.period_end)} from ${payout.tenant_names}`,
        `£${payout.gross_rent.toFixed(2)}`, '£0.00', `£${payout.gross_rent.toFixed(2)}`
      )
      doc.moveDown(0.5)

      // === EXPENDITURE ===
      if (includedCharges.length > 0) {
        separator()
        sectionTitle('Expenditure')
        tableHeader()
        for (const c of includedCharges) {
          tableRow(c.description, `£${c.net_amount.toFixed(2)}`, `£${c.vat_amount.toFixed(2)}`, `£${c.gross_amount.toFixed(2)}`)
        }
        doc.moveDown(0.3)
        doc.moveTo(cNet, doc.y).lineTo(R, doc.y).strokeColor('#d1d5db').lineWidth(0.5).stroke()
        doc.moveDown(0.3)
        tableRow('Total Charges', '', '', `£${payout.total_charges.toFixed(2)}`, true)
        doc.moveDown(0.5)
      }

      // === DISBURSEMENT ===
      separator()
      sectionTitle('Disbursement')
      tableRow(`Payment made on ${statementDate}`, '', '', `£${payout.net_payout.toFixed(2)}`)
      doc.moveDown(1)

      // === NET PAYOUT BOX ===
      const by = doc.y
      doc.save()
      doc.roundedRect(L, by, W, 44, 4).fill('#f0fdf4')
      doc.roundedRect(L, by, W, 44, 4).strokeColor('#bbf7d0').lineWidth(1).stroke()
      doc.restore()
      doc.fontSize(12).fillColor('#1f2937').font('Helvetica-Bold').text('Net Payout', L + 16, by + 14)
      doc.fontSize(16).fillColor('#059669').font('Helvetica-Bold').text(`£${payout.net_payout.toFixed(2)}`, L + 16, by + 11, { width: W - 32, align: 'right' })
      doc.y = by + 54

      // === FOOTER ===
      doc.moveDown(0.8)
      doc.fontSize(8).fillColor('#6b7280').font('Helvetica')
      doc.text(`The above disbursement has been paid to the bank details held on file for: ${landlordFullName}.`, L, doc.y, { width: W })
      doc.moveDown(1.5)
      doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke()
      doc.moveDown(0.4)
      doc.fontSize(7).fillColor('#9ca3af')
      doc.text(`Statement reference: ${payout.statement_ref}`, L)
      doc.text(`Generated by ${companyName} via PropertyGoose`, L)

      doc.end()
    } catch (err) { reject(err) }
  })

  const now = new Date()
  const storagePath = `statements/${payout.landlord_id}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${payout.statement_ref}_${payout.period_start}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (uploadError) console.error('Failed to upload statement PDF:', uploadError)

  return { storagePath, pdfBuffer }
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

import PDFDocument from 'pdfkit'
import { supabase } from '../config/supabase'
import { decrypt } from './encryption'
import fs from 'fs'
import path from 'path'
import https from 'https'

export interface RemittanceData {
  contractor_name: string
  contractor_email?: string
  invoice_number: string
  invoice_date: string
  property_address: string
  gross_amount: number
  commission_percent: number
  commission_net: number
  commission_vat_amount: number
  payout_amount: number
  commission_vat: boolean
}

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

export async function generateContractorRemittance(
  companyId: string,
  data: RemittanceData
): Promise<{ storagePath: string; pdfBuffer: Buffer }> {
  // Get company details
  const { data: company } = await supabase
    .from('companies')
    .select('name_encrypted, address_encrypted, city_encrypted, postcode_encrypted, phone_encrypted, email_encrypted, logo_url, primary_color')
    .eq('id', companyId)
    .single()

  const companyName = (company?.name_encrypted ? decrypt(company.name_encrypted) : null) || 'PropertyGoose'
  const companyAddress = [
    company?.address_encrypted ? decrypt(company.address_encrypted) : null,
    company?.city_encrypted ? decrypt(company.city_encrypted) : null,
    company?.postcode_encrypted ? decrypt(company.postcode_encrypted) : null,
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

  const remittanceDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const invoiceDate = new Date(data.invoice_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const remittanceRef = `REM-${Date.now().toString(36).toUpperCase()}-${data.invoice_number.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase()}`

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 50, right: 50 } })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const L = 50
      const R = 545
      const W = R - L

      function separator() {
        doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke()
        doc.moveDown(0.6)
      }

      function row(label: string, value: string, opts?: { bold?: boolean; color?: string; labelColor?: string }) {
        const y = doc.y
        doc.fontSize(10).fillColor(opts?.labelColor || '#4b5563').font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(label, L, y, { width: W * 0.6 })
        doc.fontSize(10).fillColor(opts?.color || '#1f2937').font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(value, L + W * 0.6, y, { width: W * 0.4, align: 'right' })
        doc.y = Math.max(doc.y, y + 16)
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
      doc.fontSize(18).fillColor(primaryColor).font('Helvetica-Bold').text('Remittance Advice', L, doc.y, { width: W, align: 'center' })
      doc.moveDown(0.8)

      // === META GRID ===
      const my = doc.y
      doc.fontSize(7).fillColor('#9ca3af').font('Helvetica').text('CONTRACTOR', L, my)
      doc.fontSize(10).fillColor('#1f2937').font('Helvetica-Bold').text(data.contractor_name, L, my + 12)

      doc.fontSize(7).fillColor('#9ca3af').font('Helvetica').text('DATE', 310, my)
      doc.fontSize(10).fillColor('#1f2937').font('Helvetica-Bold').text(remittanceDate, 310, my + 12)

      doc.fontSize(7).fillColor('#9ca3af').font('Helvetica').text('PROPERTY', L, my + 36)
      doc.fontSize(10).fillColor('#1f2937').font('Helvetica-Bold').text(data.property_address || 'N/A', L, my + 48, { width: 240 })

      doc.fontSize(7).fillColor('#9ca3af').font('Helvetica').text('INVOICE', 310, my + 36)
      doc.fontSize(10).fillColor('#1f2937').font('Helvetica-Bold').text(`#${data.invoice_number}`, 310, my + 48)
      doc.fontSize(8).fillColor('#6b7280').font('Helvetica').text(`Dated: ${invoiceDate}`, 310, my + 60)

      doc.y = my + 80
      doc.moveDown(0.5)
      separator()

      // === INVOICE BREAKDOWN ===
      doc.fontSize(11).fillColor(primaryColor).font('Helvetica-Bold').text('Payment Breakdown', L, doc.y, { width: W })
      doc.moveDown(0.6)

      row('Invoice gross amount', `£${data.gross_amount.toFixed(2)}`)
      doc.moveDown(0.3)

      if (data.commission_net > 0) {
        const commLabel = data.commission_vat
          ? `Agency commission (${data.commission_percent}% + VAT)`
          : `Agency commission (${data.commission_percent}%)`
        const commTotal = data.commission_net + data.commission_vat_amount

        separator()
        doc.fontSize(11).fillColor(primaryColor).font('Helvetica-Bold').text('Deductions', L, doc.y, { width: W })
        doc.moveDown(0.6)

        row('Commission net', `£${data.commission_net.toFixed(2)}`, { color: '#dc2626' })
        if (data.commission_vat_amount > 0) {
          row('Commission VAT (20%)', `£${data.commission_vat_amount.toFixed(2)}`, { color: '#dc2626' })
        }
        row('Total deductions', `-£${commTotal.toFixed(2)}`, { bold: true, color: '#dc2626' })
        doc.moveDown(0.3)
      }

      separator()

      // === DISBURSEMENT ===
      doc.fontSize(11).fillColor(primaryColor).font('Helvetica-Bold').text('Disbursement', L, doc.y, { width: W })
      doc.moveDown(0.6)
      row(`Payment made on ${remittanceDate}`, `£${data.payout_amount.toFixed(2)}`)
      doc.moveDown(1)

      // === NET PAYOUT BOX ===
      const by = doc.y
      doc.save()
      doc.roundedRect(L, by, W, 44, 4).fill('#f0fdf4')
      doc.roundedRect(L, by, W, 44, 4).strokeColor('#bbf7d0').lineWidth(1).stroke()
      doc.restore()
      doc.fontSize(12).fillColor('#1f2937').font('Helvetica-Bold').text('Amount Paid', L + 16, by + 14)
      doc.fontSize(16).fillColor('#059669').font('Helvetica-Bold').text(`£${data.payout_amount.toFixed(2)}`, L + 16, by + 11, { width: W - 32, align: 'right' })
      doc.y = by + 54

      // === FOOTER ===
      doc.moveDown(0.8)
      doc.fontSize(8).fillColor('#6b7280').font('Helvetica')
      doc.text(`This remittance confirms payment for invoice #${data.invoice_number} has been made to ${data.contractor_name}.`, L, doc.y, { width: W })
      doc.moveDown(1.5)
      doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke()
      doc.moveDown(0.4)
      doc.fontSize(7).fillColor('#9ca3af')
      doc.text(`Remittance reference: ${remittanceRef}`, L)
      doc.text(`Generated by ${companyName} via PropertyGoose`, L)

      doc.end()
    } catch (err) { reject(err) }
  })

  const now = new Date()
  const storagePath = `remittances/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${remittanceRef}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (uploadError) console.error('Failed to upload remittance PDF:', uploadError)

  return { storagePath, pdfBuffer }
}

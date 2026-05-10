/**
 * pdfExporter.js
 * Generates a styled PDF from the merged unit question bank using jsPDF + jspdf-autotable.
 */
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const PRIMARY = [79, 70, 229];   // indigo
const ACCENT  = [124, 58, 237];  // purple
const DARK    = [30, 27, 75];    // text-primary
const GREY    = [75, 85, 99];    // text-secondary
const LIGHT   = [247, 248, 252]; // bg
const WHITE   = [255, 255, 255];
const BORDER  = [226, 232, 240];

/**
 * Format question texts: join variants with " / "
 */
function formatText(texts) {
  if (!texts || texts.length === 0) return '';
  return texts.join(' / ');
}

/**
 * Export all units to a single PDF.
 * @param {Array} units - Merged unit array from mergeAndDeduplicate()
 * @param {string} subject - Subject name for the header
 * @param {string} filename - Output filename
 */
export function exportAllUnitsPDF(units, subject = 'Exam Questions', filename = 'ExamFriend_Questions.pdf') {
  const doc = buildDoc(units, subject);
  doc.save(filename);
}

/**
 * Export a single unit to its own PDF.
 */
export function exportSingleUnitPDF(unit, subject = 'Exam Questions') {
  const filename = `ExamFriend_Unit${unit.unitNumber}_${unit.coLabel}.pdf`;
  const doc = buildDoc([unit], subject);
  doc.save(filename);
}

function buildDoc(units, subject) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  // ── Cover Header ──
  // Gradient-like header rectangle
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 42, 'F');

  // App name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text('ExamFriend', margin, 18);

  // Subject
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 255);
  doc.text(subject, margin, 27);

  // Generated date
  const date = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  doc.setFontSize(9);
  doc.text(`Generated: ${date}`, margin, 37);

  // Stats (right side)
  const totalQ = units.reduce((s, u) => s + u.questions.length, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text(`${units.length} Units`, pageW - margin, 22, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 255);
  doc.text(`${totalQ} unique questions`, pageW - margin, 30, { align: 'right' });

  let yPos = 50;

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];

    // Check if we need a new page for the unit header
    if (yPos > pageH - 40) {
      doc.addPage();
      yPos = 20;
    }

    // ── Unit Header ──
    doc.setFillColor(...LIGHT);
    doc.roundedRect(margin, yPos, pageW - margin * 2, 16, 3, 3, 'F');
    doc.setFillColor(...PRIMARY);
    doc.roundedRect(margin, yPos, 32, 16, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text(`U${unit.unitNumber}`, margin + 16, yPos + 10.5, { align: 'center' });

    doc.setTextColor(...DARK);
    doc.setFontSize(11);
    doc.text(`Unit ${unit.unitNumber}  —  ${unit.coLabel}`, margin + 38, yPos + 10.5);

    const uQCount = unit.questions.length;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text(`${uQCount} question${uQCount !== 1 ? 's' : ''}`, pageW - margin, yPos + 10.5, { align: 'right' });

    yPos += 22;

    // ── Questions Table ──
    const tableRows = [];
    const partOrder = ['a', 'b', 'c', 'd', 'e'];

    // Group by part to insert OR dividers
    let lastPart = null;
    let orInserted = false;

    for (const q of unit.questions) {
      // Insert OR divider before the "e" part (which is the OR alternative to "d")
      if (q.part === 'e' && lastPart === 'd' && !orInserted) {
        tableRows.push(['', '— OR —', '', '']);
        orInserted = true;
      }
      if (q.part === 'd') orInserted = false;

      const partLabel = q.part ? q.part.toUpperCase() : '-';
      const questionText = formatText(q.texts);
      const marksText = q.marks ? `${q.marks} M` : '';
      const freqText = q.frequency > 1 ? `×${q.frequency}` : '';

      tableRows.push([partLabel, questionText, marksText, freqText]);
      lastPart = q.part;
    }

    doc.autoTable({
      startY: yPos,
      margin: { left: margin, right: margin },
      head: [['Part', 'Question', 'Marks', 'Freq']],
      body: tableRows,
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
        textColor: DARK,
        lineColor: BORDER,
        lineWidth: 0.2,
        overflow: 'linebreak',
        valign: 'top',
      },
      headStyles: {
        fillColor: PRIMARY,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 14, halign: 'center' },
      },
      alternateRowStyles: { fillColor: [248, 249, 255] },
      didParseCell(data) {
        // Style the OR row
        if (data.row.raw && data.row.raw[1] === '— OR —') {
          data.cell.styles.textColor = PRIMARY;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.halign = 'center';
          data.cell.styles.fillColor = [238, 242, 255];
        }
      },
      didDrawPage(pageData) {
        // Footer on each page
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 170);
        doc.text(
          `ExamFriend  ·  ${subject}  ·  Page ${pageData.pageNumber}`,
          pageW / 2,
          pageH - 8,
          { align: 'center' }
        );
      },
    });

    yPos = doc.lastAutoTable.finalY + 14;
  }

  return doc;
}

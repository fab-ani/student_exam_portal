import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import type { StudentSession } from "./types";
import { formatSeconds } from "./format";

interface ExportInput {
  examTitle: string;
  examId: string;
  generatedAt: Date;
  sessions: StudentSession[];
}

export function downloadExamPdf(input: ExportInput) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text(input.examTitle, 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`Exam ID: ${input.examId}`, 14, 28);
  doc.text(`Generated: ${input.generatedAt.toLocaleString()}`, 14, 34);
  doc.text(`Students: ${input.sessions.length}`, 14, 40);

  const rows = input.sessions.map((s) => [
    s.studentName,
    s.status,
    String(s.violationCount),
    formatSeconds(s.totalTimeAway),
    new Date(s.updatedTime).toLocaleString(),
  ]);

  autoTable(doc, {
    startY: 48,
    head: [["Student", "Status", "Switches", "Total Away", "Last Update"]],
    body: rows,
    headStyles: { fillColor: [22, 163, 74], textColor: 255 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    styles: { fontSize: 10, cellPadding: 3 },
  });

  const safeTitle = input.examTitle.replace(/[^a-z0-9_-]+/gi, "_");
  doc.save(`${safeTitle}_${input.examId}.pdf`);
}

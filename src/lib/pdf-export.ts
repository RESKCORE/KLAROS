import jsPDF from 'jspdf';
import type { Decision, AnalysisResult } from '@/types/decision';

export async function exportDecisionToPDF(decision: Decision, result: AnalysisResult) {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = 20;

    // Helper function to check if we need a new page
    const checkNewPage = (requiredSpace: number = 20) => {
      if (yPos + requiredSpace > pageHeight - 30) {
        doc.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    // Helper to draw section header
    const drawSectionHeader = (title: string) => {
      checkNewPage(30);
      doc.setFillColor(124, 58, 237);
      doc.rect(margin, yPos, contentWidth, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin + 5, yPos + 7);
      yPos += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    };

    // Helper to draw info box
    const drawInfoBox = (title: string, content: string, color: [number, number, number] = [239, 246, 255]) => {
      checkNewPage(40);
      const boxHeight = 35;
      doc.setFillColor(...color);
      doc.setDrawColor(124, 58, 237);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, boxHeight, 3, 3, 'FD');
      
      doc.setFontSize(10);
      doc.setTextColor(124, 58, 237);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin + 5, yPos + 8);
      
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(content, margin + 5, yPos + 20);
      
      yPos += boxHeight + 10;
    };

    // ===== COVER PAGE =====
    // Title with spacing for logo
    yPos = 70;
    doc.setFontSize(28);
    doc.setTextColor(124, 58, 237);
    doc.setFont('helvetica', 'bold');
    doc.text('Decision Analysis Report', pageWidth / 2, yPos, { align: 'center' });
    
    // Brand name
    yPos = 50;
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237);
    doc.setFont('helvetica', 'bold');
    doc.text('KLAROS', pageWidth / 2, yPos, { align: 'center' });

    // Decision Title
    yPos = 110;
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(decision.title, contentWidth - 20);
    titleLines.forEach((line: string) => {
      doc.text(line, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
    });

    // Date and metadata
    yPos = pageHeight - 80;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 8;
    doc.text(`Analysis ID: ${decision.id.substring(0, 8).toUpperCase()}`, pageWidth / 2, yPos, { align: 'center' });

    // Decorative line
    doc.setDrawColor(124, 58, 237);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 50, pageWidth - margin, pageHeight - 50);

    // ===== PAGE 2: EXECUTIVE SUMMARY =====
    doc.addPage();
    yPos = margin;

    // Page title
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary', margin, yPos);
    yPos += 15;

    // Context section
    if (decision.context) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Context', margin, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      const contextLines = doc.splitTextToSize(decision.context, contentWidth);
      contextLines.forEach((line: string) => {
        checkNewPage(10);
        doc.text(line, margin, yPos);
        yPos += 5;
      });
      yPos += 10;
    }

    // Recommendation box
    drawInfoBox(
      'RECOMMENDED OPTION',
      result.recommendation.optionLabel,
      [239, 246, 255]
    );

    // Confidence indicator
    const confidence = Math.round(result.recommendation.confidence * 100);
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(margin, yPos, contentWidth, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Confidence Level: ${confidence}%`, margin + 5, yPos + 6);
    yPos += 15;

    // Summary text
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    const summaryLines = doc.splitTextToSize(result.recommendation.summary, contentWidth);
    summaryLines.forEach((line: string) => {
      checkNewPage(10);
      doc.text(line, margin, yPos);
      yPos += 5;
    });
    yPos += 15;

    // ===== DETAILED SCORES SECTION =====
    drawSectionHeader('DETAILED SCORES');

    // Sort scores by totalScore (descending) and add rank
    const sortedScores = [...result.scores]
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((score, index) => ({ ...score, rank: index + 1 }));

    // Calculate normalized scores
    const maxScore = Math.max(...sortedScores.map(s => s.totalScore));
    const scoresWithNormalized = sortedScores.map(score => ({
      ...score,
      normalizedScore: maxScore > 0 ? (score.totalScore / maxScore) * 100 : 0
    }));

    // Table header
    const colRank = margin + 5;
    const colOption = margin + 20;
    const colTotal = pageWidth - margin - 45;
    const colNorm = pageWidth - margin - 5;
    
    doc.setFillColor(124, 58, 237);
    doc.rect(margin, yPos, contentWidth, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Rank', colRank, yPos + 7);
    doc.text('Option', colOption, yPos + 7);
    doc.text('Total Score', colTotal, yPos + 7);
    doc.text('Normalized', colNorm, yPos + 7, { align: 'right' });
    yPos += 10;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    scoresWithNormalized.forEach((score, index) => {
      checkNewPage(12);
      
      // Alternate row colors
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, yPos, contentWidth, 10, 'F');
      }
      
      // Rank with medal for top 3
      doc.setTextColor(0, 0, 0);
      let rankText = '';
      if (score.rank === 1) rankText = '#1';
      else if (score.rank === 2) rankText = '#2';
      else if (score.rank === 3) rankText = '#3';
      else rankText = `#${score.rank}`;
      
      doc.setFont('helvetica', 'bold');
      doc.text(rankText, colRank, yPos + 7);
      
      // Option name (truncate if too long)
      doc.setFont('helvetica', 'normal');
      const optionText = score.optionLabel.length > 40 
        ? score.optionLabel.substring(0, 37) + '...' 
        : score.optionLabel;
      doc.text(optionText, colOption, yPos + 7);
      
      // Scores
      doc.text(score.totalScore.toFixed(2), colTotal, yPos + 7);
      doc.text(score.normalizedScore.toFixed(1) + '%', colNorm, yPos + 7, { align: 'right' });
      
      yPos += 10;
    });

    yPos += 15;

    // ===== CRITERIA BREAKDOWN =====
    drawSectionHeader('CRITERIA ANALYSIS');

    scoresWithNormalized.forEach((score) => {
      checkNewPage(50);
      
      // Option header with rank badge
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(124, 58, 237);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'FD');
      
      doc.setFontSize(11);
      doc.setTextColor(124, 58, 237);
      doc.setFont('helvetica', 'bold');
      doc.text(score.optionLabel, margin + 5, yPos + 8);
      
      // Rank badge
      doc.setFillColor(124, 58, 237);
      doc.roundedRect(pageWidth - margin - 30, yPos + 2, 25, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(`Rank #${score.rank}`, pageWidth - margin - 28, yPos + 7);
      
      yPos += 18;

      // Criteria table header
      doc.setFillColor(240, 240, 240);
      doc.rect(margin + 5, yPos, contentWidth - 10, 8, 'F');
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Criterion', margin + 8, yPos + 6);
      doc.text('Score', pageWidth - margin - 25, yPos + 6);
      yPos += 10;
      
      // Criteria scores
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      score.criteriaScores.forEach((cs, idx) => {
        checkNewPage(10);
        
        // Alternate row background
        if (idx % 2 === 1) {
          doc.setFillColor(252, 252, 252);
          doc.rect(margin + 5, yPos - 2, contentWidth - 10, 8, 'F');
        }
        
        // Criterion name
        doc.setTextColor(40, 40, 40);
        const criterionText = cs.criterionName.length > 45 
          ? cs.criterionName.substring(0, 42) + '...' 
          : cs.criterionName;
        doc.text(criterionText, margin + 8, yPos + 4);
        
        // Score with color coding
        const scoreValue = cs.score.toFixed(1);
        if (cs.score >= 8) doc.setTextColor(34, 197, 94); // Green
        else if (cs.score >= 6) doc.setTextColor(234, 179, 8); // Yellow
        else doc.setTextColor(239, 68, 68); // Red
        
        doc.setFont('helvetica', 'bold');
        doc.text(scoreValue, pageWidth - margin - 25, yPos + 4);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        yPos += 8;
      });
      
      yPos += 12;
    });

    // ===== AI REASONING SECTION =====
    doc.addPage();
    yPos = margin;

    drawSectionHeader('AI REASONING & INSIGHTS');

    // Decomposition
    if (result.reasoning?.decomposition) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(124, 58, 237);
      doc.setLineWidth(0.3);
      
      // Calculate box height based on content
      const decompLines = doc.splitTextToSize(result.reasoning.decomposition, contentWidth - 20);
      const boxHeight = Math.max(25, decompLines.length * 5 + 15);
      
      checkNewPage(boxHeight + 5);
      doc.roundedRect(margin, yPos, contentWidth, boxHeight, 2, 2, 'FD');
      
      doc.setFontSize(10);
      doc.setTextColor(124, 58, 237);
      doc.setFont('helvetica', 'bold');
      doc.text('Analysis Approach', margin + 5, yPos + 8);
      yPos += 13;
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      decompLines.forEach((line: string) => {
        doc.text(line, margin + 5, yPos);
        yPos += 5;
      });
      yPos += 10;
    }

    // Assumptions
    if (result.reasoning?.assumptions && result.reasoning.assumptions.length > 0) {
      checkNewPage(30);
      doc.setFontSize(11);
      doc.setTextColor(124, 58, 237);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Assumptions', margin, yPos);
      yPos += 8;
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      
      result.reasoning.assumptions.forEach((assumption, i) => {
        checkNewPage(20);
        
        // Bullet point
        doc.setFillColor(124, 58, 237);
        doc.circle(margin + 3, yPos - 1, 1, 'F');
        
        const lines = doc.splitTextToSize(assumption, contentWidth - 15);
        lines.forEach((line: string, lineIdx: number) => {
          doc.text(line, margin + 8, yPos);
          yPos += 5;
        });
        yPos += 2;
      });
      yPos += 8;
    }

    // Tradeoffs
    if (result.reasoning?.tradeoffs && result.reasoning.tradeoffs.length > 0) {
      checkNewPage(30);
      doc.setFontSize(11);
      doc.setTextColor(234, 179, 8);
      doc.setFont('helvetica', 'bold');
      doc.text('Important Tradeoffs', margin, yPos);
      yPos += 8;
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      
      result.reasoning.tradeoffs.forEach((tradeoff, i) => {
        checkNewPage(20);
        
        // Bullet point
        doc.setFillColor(234, 179, 8);
        doc.circle(margin + 3, yPos - 1, 1, 'F');
        
        const lines = doc.splitTextToSize(tradeoff, contentWidth - 15);
        lines.forEach((line: string) => {
          doc.text(line, margin + 8, yPos);
          yPos += 5;
        });
        yPos += 2;
      });
      yPos += 8;
    }

    // Risks
    if (result.reasoning?.risks && result.reasoning.risks.length > 0) {
      checkNewPage(30);
      doc.setFontSize(11);
      doc.setTextColor(239, 68, 68);
      doc.setFont('helvetica', 'bold');
      doc.text('Potential Risks', margin, yPos);
      yPos += 8;
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      
      result.reasoning.risks.forEach((risk, i) => {
        checkNewPage(20);
        
        // Warning bullet point
        doc.setFillColor(239, 68, 68);
        doc.circle(margin + 3, yPos - 1, 1, 'F');
        
        const lines = doc.splitTextToSize(risk, contentWidth - 15);
        lines.forEach((line: string) => {
          doc.text(line, margin + 8, yPos);
          yPos += 5;
        });
        yPos += 2;
      });
      yPos += 8;
    }

    // Sensitivity
    if (result.reasoning?.sensitivity) {
      checkNewPage(30);
      
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(124, 58, 237);
      doc.setLineWidth(0.3);
      
      const sensLines = doc.splitTextToSize(result.reasoning.sensitivity, contentWidth - 20);
      const boxHeight = Math.max(25, sensLines.length * 5 + 15);
      
      checkNewPage(boxHeight + 5);
      doc.roundedRect(margin, yPos, contentWidth, boxHeight, 2, 2, 'FD');
      
      doc.setFontSize(10);
      doc.setTextColor(124, 58, 237);
      doc.setFont('helvetica', 'bold');
      doc.text('Sensitivity Analysis', margin + 5, yPos + 8);
      yPos += 13;
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      sensLines.forEach((line: string) => {
        doc.text(line, margin + 5, yPos);
        yPos += 5;
      });
    }

    // ===== FOOTER ON ALL PAGES =====
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Footer line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      // Footer text
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'Generated by KLAROS Decision Navigator',
        margin,
        pageHeight - 10
      );
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - margin,
        pageHeight - 10,
        { align: 'right' }
      );
    }

    // Save the PDF
    const fileName = `KLAROS_${decision.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
    
    return true;
  } catch (error) {
    console.error('PDF Export Error:', error);
    throw error;
  }
}

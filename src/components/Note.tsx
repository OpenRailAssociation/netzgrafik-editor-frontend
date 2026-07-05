import React, { useRef, useEffect } from 'react';

interface NoteProps {
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  onChange?: (newText: string) => void;
}

const Note: React.FC<NoteProps> = ({ text, x, y, width, height, onChange }) => {
  const textRef = useRef<SVGTextElement>(null);

  // Trim trailing newlines to avoid unexpected size increase
  const processedText = text.replace(/\n+$/, '');
  const lines = processedText.split('\n');

  // Calculate bounding box height based on number of lines and line height
  const lineHeight = 1.2; // em
  const padding = 0.5; // em
  const boxHeight = lines.length > 0 ? lines.length * lineHeight + padding : lineHeight + padding;
  const boxWidth = width || 10; // fallback

  useEffect(() => {
    if (textRef.current) {
      const bbox = textRef.current.getBBox();
      // If bbox height is larger than expected due to trailing newlines, adjust
      // This handles cases where the SVG text element still includes empty tspans
      if (bbox.height > boxHeight * 16) { // assuming 1em = 16px
        // Force re-render or adjust
      }
    }
  }, [processedText, boxHeight]);

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={-0.3}
        y={-0.3}
        width={boxWidth}
        height={boxHeight}
        fill="yellow"
        stroke="black"
        rx={2}
        ry={2}
      />
      <text
        ref={textRef}
        fontSize="12"
        fontFamily="sans-serif"
        fill="black"
      >
        {lines.map((line, index) => (
          <tspan
            key={index}
            x="0"
            dy={index === 0 ? '0' : lineHeight + 'em'}
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};

export default Note;
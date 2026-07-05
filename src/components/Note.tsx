import React from 'react';

interface NoteProps {
  text: string;
}

function linkify(text: string): string {
  // Escape HTML to prevent XSS
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Convert plain URLs to anchor tags
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return escaped.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

const Note: React.FC<NoteProps> = ({ text }) => {
  return (
    <div
      className="note-content"
      dangerouslySetInnerHTML={{ __html: linkify(text) }}
    />
  );
};

export default Note;

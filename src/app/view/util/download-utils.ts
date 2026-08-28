export const downloadBlob = (blob: Blob, fileName: string) => {
  // https://framagit.org/i.kulgu/lufi/commit/a2921150c4289dffaa40b7feddcd900019655938#663e1fb05fc330c70ed7420bccacc19fb45be9b7
  const nav = window.navigator as Navigator & {
    msSaveOrOpenBlob?: unknown;
    msSaveBlob?: (blob: Blob, filename: string) => void;
  };
  if (nav.msSaveOrOpenBlob) {
    nav.msSaveBlob(blob, fileName);
  } else {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }
};

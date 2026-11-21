import { createRoot } from 'react-dom/client';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Không tìm thấy phần tử root');
}

createRoot(container).render(<h1>CaroCard</h1>);

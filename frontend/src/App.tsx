import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { DjRoomPage } from './pages/DjRoomPage';
import { GuestJoinPage } from './pages/GuestJoinPage';
import { GuestRoomPage } from './pages/GuestRoomPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dj/:code" element={<DjRoomPage />} />
        <Route path="/join" element={<GuestJoinPage />} />
        <Route path="/room/:code" element={<GuestRoomPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

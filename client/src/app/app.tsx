import { Routes, Route } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Dashboard from '../pages/Dashboard';
import RoomDetail from '../pages/RoomDetail';
import Transcripts from '../pages/Transcripts';

export function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/"             element={<Dashboard />} />
        <Route path="/room/:id"     element={<RoomDetail />} />
        <Route path="/transcripts"  element={<Transcripts />} />
      </Routes>
    </>
  );
}

export default App;

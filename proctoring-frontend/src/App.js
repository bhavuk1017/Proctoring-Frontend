import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ProctoredTest from "./ProctoredTest";
import AdminDashboard from "./AdminDashboard";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/test" />} />
        <Route path="/test" element={<ProctoredTest />} />
        <Route path="/admin" element={<AdminDashboard/>}/>
      </Routes>
    </Router>
  );
}

export default App;

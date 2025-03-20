import React, { useEffect, useState } from "react";
import axios from "axios";

function AdminDashboard() {
  const [violations, setViolations] = useState([]);
  const [error, setError] = useState(null);

  // Fetch violations initially and every 10 seconds
  useEffect(() => {
    fetchViolations();
    const interval = setInterval(fetchViolations, 10000); // Auto-refresh every 10 sec
    return () => clearInterval(interval);
  }, []);

  const fetchViolations = async () => {
    try {
      const response = await axios.get("http://localhost:5000/violations");
      setViolations(response.data);
      setError(null); // Reset error if successful
    } catch (err) {
      console.error("Error fetching violations:", err);
      setError("Failed to fetch violations. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-6">
      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-4xl">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Admin Dashboard</h1>

        {error && <p className="text-red-500 font-semibold mb-4">{error}</p>}

        <table className="w-full border-collapse bg-white shadow rounded-lg">
          <thead>
            <tr className="bg-gray-200 text-gray-700">
              <th className="px-4 py-3 text-left">Violation Type</th>
              <th className="px-4 py-3 text-left">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {violations.length > 0 ? (
              violations.map((violation, index) => (
                <tr
                  key={index}
                  className="border-b hover:bg-gray-100 transition duration-200"
                >
                  <td className="px-4 py-3">{violation.type}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(violation.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="2" className="px-4 py-4 text-center text-gray-500">
                  No violations recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminDashboard;

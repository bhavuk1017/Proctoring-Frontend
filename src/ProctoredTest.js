import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import io from 'socket.io-client';


function ProctoredTest() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [isSharing, setIsSharing] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [warning, setWarning] = useState("");
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [screenStream, setScreenStream] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [scheduledCountdown, setScheduledCountdown] = useState(null);
  const skill = searchParams.get("skill") || "";
  const email = searchParams.get("email") || "";
  const testDate = searchParams.get("testDate") || "";
  const testTime = searchParams.get("testTime") || "";
  const [socket, setSocket] = useState(null);
  
  // Check if today is the scheduled test date
  useEffect(() => {
    if (testDate && testTime) {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const scheduledDate = testDate;
      const [scheduledHour, scheduledMinute] = testTime.split(':').map(Number);
      
      // Check if date is valid
      if (currentDate < scheduledDate) {
        setWarning(`This test is scheduled for ${scheduledDate} at ${testTime}. Please return at the scheduled time.`);
        
        // Calculate time until test in seconds
        const scheduledDateTime = new Date(`${scheduledDate}T${testTime}`);
        const timeUntilTest = Math.floor((scheduledDateTime - now) / 1000);
        setScheduledCountdown(timeUntilTest);
        
      } else if (currentDate > scheduledDate) {
        setWarning(`This test was scheduled for ${scheduledDate} at ${testTime} and has expired. Please contact your administrator.`);
      }
      // If same date, check time
      else if (currentDate === scheduledDate) {
        const currentTimeMinutes = currentHour * 60 + currentMinute;
        const scheduledTimeMinutes = scheduledHour * 60 + scheduledMinute;
        
        // Allow test to be taken 15 minutes before scheduled time and up to 60 minutes after
        if (currentTimeMinutes < scheduledTimeMinutes - 15) {
          setWarning(`This test is scheduled for today at ${testTime}. Please return at the scheduled time.`);
          
          // Calculate time until test in seconds
          const timeUntilTest = (scheduledTimeMinutes - 15 - currentTimeMinutes) * 60;
          setScheduledCountdown(timeUntilTest);
        } else if (currentTimeMinutes > scheduledTimeMinutes + 60) {
          setWarning(`This test was scheduled for today at ${testTime} and has expired. Please contact your administrator.`);
        }
      }
    }
  }, [testDate, testTime]);

// Add a new useEffect for the scheduled countdown timer
useEffect(() => {
  if (scheduledCountdown === null || testStarted) return;
  
  const interval = setInterval(() => {
    setScheduledCountdown(prev => {
      if (prev <= 1) {
        clearInterval(interval);
        // Refresh the page when countdown reaches zero to update the test availability
        window.location.reload();
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  
  return () => clearInterval(interval);
}, [scheduledCountdown, testStarted]);

// Format time display for days, hours, minutes, seconds
const formatCountdown = (seconds) => {
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  let result = '';
  if (days > 0) result += `${days}d `;
  if (hours > 0 || days > 0) result += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}m `;
  result += `${secs}s`;
  
  return result;
};
  

  console.log("Skill:", skill);
  console.log("Email:", email);

  // Generate test questions directly in React
  const generateTest = async () => {
    setIsLoading(true);
    try {
      const testPrompt = `
        Generate a 10-question test for ${skill}.
        The test should:
        1. Cover fundamental concepts
        2. Include advanced topics
        3. Test practical understanding
        4. Assess problem-solving ability
        Output the questions in a numbered list format.
      `;
      
      // Using your backend to proxy the AI request
      const response = await axios.post("https://node-server-backend-9dd8.onrender.com/generate-ai-response", {
        prompt: testPrompt
      });
      
      const rawQuestions = response.data.result;
      // Parse questions into a list
      const parsedQuestions = rawQuestions
        .split("\n")
        .filter(q => q.trim() && q.trim().match(/^\d+\./))
        .map(q => q.replace(/^\d+[\.\)]\s*/, "").trim());
      
      if (parsedQuestions.length >= 10) {
        setQuestions(parsedQuestions.slice(0, 10));
        setAnswers(Array(10).fill(""));
        setIsLoading(false);
        return true;
      } else {
        setIsLoading(false);
        alert("Failed to generate proper test questions. Please try again.");
        return false;
      }
    } catch (error) {
      console.error("Error generating test:", error);
      setIsLoading(false);
      alert("Error generating test. Please try again.");
      return false;
    }
  };

  // Log violations
  const logViolation = async (type) => {
    if (testStarted && !testSubmitted) {
      alert(`Violation Detected: ${type}`);
      setWarning(`Violation: ${type}`);
      try {
        await axios.post("https://node-server-backend-9dd8.onrender.com/log-violation", { 
          type,
          email,
          skill
        });
      } catch (error) {
        console.error("Error logging violation:", error);
      }
    }
  };

  // Start camera when test begins
  useEffect(() => {
    if (!testStarted) return;
    
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      } 
    })
    .then(stream => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.error("Error playing video:", e));
      }
    })
    .catch(err => {
      console.error("Camera error:", err);
      logViolation("Camera Access Denied");
    });
  }, [testStarted]);

  useEffect(() => {
    if (!testStarted || testSubmitted) return;
    
    // Connect to socket server
    const proctorSocket = io('https://webcam-proctoring-backend.onrender.com');
    setSocket(proctorSocket);
    
    // Handle socket connection
    proctorSocket.on('connect', () => {
      console.log('Connected to proctoring server');
      proctorSocket.emit('register', { email, skill });
    });
    
    // Handle violations from server
    proctorSocket.on('violation', (data) => {
      logViolation(data.type);
    });
    
    // Handle disconnection
    proctorSocket.on('disconnect', () => {
      console.log('Disconnected from proctoring server');
    });
    
    // Set up interval for sending frames
    const interval = setInterval(() => {
      if (!videoRef.current || !videoRef.current.srcObject) return;
      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) return;
      
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      // Send frame as base64 string instead of blob for socket efficiency
      const imageData = canvas.toDataURL('image/jpeg', 0.7);
      proctorSocket.emit('frame', { image: imageData });
    }, 2000);
    
    return () => {
      clearInterval(interval);
      if (proctorSocket) {
        proctorSocket.disconnect();
      }
    };
  }, [testStarted, testSubmitted, email, skill]);

  // Detect tab switching
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (testStarted && !testSubmitted && document.hidden) {
        logViolation("Tab Switch Detected");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [testStarted, testSubmitted]);

  // Start screen sharing and test
  const startScreenShare = async () => {
    try {
      // First generate the test
      const success = await generateTest();
      if (!success) return;
      
      // Then start screen sharing
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(stream);
      setIsSharing(true);
      setTestStarted(true);
      setWarning("");
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (!testSubmitted) {
          logViolation("Screen Sharing Stopped");
        }
      });
    } catch (err) {
      console.error("Screen sharing error:", err);
      logViolation("Screen Sharing Denied");
    }
  };

  // Stop screen sharing and camera
  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsSharing(false);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  // Submit test answers back to the server
  const submitTest = async () => {
    try {
      const response = await axios.post("https://node-server-backend-9dd8.onrender.com/submit-test", {
        email: email,
        skill: skill,
        questions: questions,
        answers: answers
      });
      
      alert(`Test submitted! Score: ${response.data.score}/10`);
      setTestSubmitted(true);
      stopScreenShare();
      
      // Redirect back to Streamlit after 2 seconds
      setTimeout(() => {
        window.location.href = "https://streamlit-app-4xyh.onrender.com";
      }, 2000);
    } catch (err) {
      console.error("Error submitting test:", err);
      alert("Error submitting test. Please try again.");
    }
  };

  // Handle answer input changes
  const handleAnswerChange = (index, value) => {
    let updatedAnswers = [...answers];
    updatedAnswers[index] = value;
    setAnswers(updatedAnswers);
  };

  // Timer countdown
  useEffect(() => {
    if (!testStarted || testSubmitted) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          submitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [testStarted, testSubmitted]);

  // Format time display
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Proctored Test for {skill}</h2>
      
      {warning && (
        <div style={{ 
          padding: "20px", 
          backgroundColor: "#ffebee", 
          border: "1px solid #f44336",
          borderRadius: "4px",
          marginBottom: "20px"
        }}>
          <p style={{ color: "red" }}>{warning}</p>
          <button 
            onClick={() => window.location.href = "https://streamlit-app-4xyh.onrender.com"}
            style={{
              padding: "10px 20px",
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              marginTop: "10px"
            }}
          >
            Return to Dashboard
          </button>
        </div>
      )}
      
      {scheduledCountdown && scheduledCountdown > 0 && (
      <div className="countdown-timer">
        <h3>Time until test is available:</h3>
        <div className="timer">{formatCountdown(scheduledCountdown)}</div>
      </div>
    )}
      
      {!testStarted && !warning && (
        <div>
          <p>You are about to take a test for: <strong>{skill}</strong></p>
          <p>Email: {email}</p>
          {testDate && <p>Scheduled Date: {testDate}</p>}
          <button 
            onClick={startScreenShare} 
            disabled={isLoading}
            style={{
              padding: "10px 20px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? "Generating Test..." : "Start Test & Screen Share"}
          </button>
          {isLoading && <p>Please wait while we generate your test questions...</p>}
        </div>
      )}
      
      {testStarted && (
        <>
          <div style={{ marginBottom: "20px", fontWeight: "bold" }}>
            ⏰ Time Left: {formatTime(timeLeft)}
          </div>
          
          {questions.map((q, i) => (
            <div key={i} style={{ marginBottom: "20px" }}>
              <p><strong>{i+1}. {q}</strong></p>
              <textarea 
                rows={4} 
                cols={50} 
                value={answers[i]} 
                onChange={(e) => handleAnswerChange(i, e.target.value)} 
                style={{ width: "100%" }}
              />
            </div>
          ))}
          
          <button 
            onClick={submitTest}
            style={{ 
              padding: "10px 20px", 
              backgroundColor: "#4CAF50", 
              color: "white", 
              border: "none", 
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Submit Test
          </button>
          
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline
            style={{ 
              position: "fixed", 
              right: "20px", 
              bottom: "20px", 
              width: "160px", 
              height: "120px", 
              border: "1px solid #ccc",
              borderRadius: "4px",
              backgroundColor: "#000"
            }} 
          />
        </>
      )}
    </div>
  );
}

export default ProctoredTest;

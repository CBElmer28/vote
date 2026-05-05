import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Vote from './pages/Vote';
import Results from './pages/Results';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="container animate-fade-in"><h3>Cargando...</h3></div>;
  if (!user) return <Navigate to="/" replace />;
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/vote" 
            element={
              <ProtectedRoute>
                <Vote />
              </ProtectedRoute>
            } 
          />
          <Route path="/results" element={<Results />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

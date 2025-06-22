// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ComponentShowcase } from './pages/ComponentShowcase';
import './App.css';

// Create a simple homepage component
const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        {/* Hero section with welcome message */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Welcome to YGG Chat
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            A modern chat application built with React, TypeScript, and Tailwind CSS.
            Explore our component library and see how everything comes together.
          </p>
        </div>

        {/* Navigation cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Component Showcase Card */}
          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Component Library
              </h2>
              <p className="text-gray-600 mb-6">
                Explore our collection of reusable UI components including buttons, 
                text fields, and more. Perfect for designers and developers to see 
                how components look and behave.
              </p>
              {/* This Link component handles navigation without page refresh */}
              <Link 
                to="/components" 
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
              >
                View Components
              </Link>
            </div>
          </div>

          {/* Chat Application Card - placeholder for future features */}
          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Chat Application
              </h2>
              <p className="text-gray-600 mb-6">
                The main chat interface where users can communicate. This section 
                will house the core chat functionality once development progresses.
              </p>
              <button 
                className="inline-block bg-gray-400 text-white px-6 py-3 rounded-lg font-medium cursor-not-allowed"
                disabled
              >
                Coming Soon
              </button>
            </div>
          </div>
        </div>

        {/* Additional information section */}
        <div className="mt-16 text-center">
          <div className="bg-white rounded-lg shadow-sm border p-8 max-w-3xl mx-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              About This Project
            </h3>
            <p className="text-gray-600 leading-relaxed">
              YGG Chat is built using modern web technologies including React 18, TypeScript, 
              Tailwind CSS, and Vite for fast development. The backend uses Node.js with 
              Prisma for database management. This homepage serves as a navigation hub 
              for different parts of the application.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App component that sets up routing
function App() {
  return (
    // BrowserRouter enables client-side routing for the entire app
    <BrowserRouter>
      <div className="App">
        {/* Routes container - only one route will be active at a time */}
        <Routes>
          {/* Route for the homepage - matches exactly "/" */}
          <Route path="/" element={<HomePage />} />
          
          {/* Route for the component showcase - matches "/components" */}
          <Route path="/components" element={<ComponentShowcase />} />
          
          {/* You can add more routes here as your app grows */}
          {/* <Route path="/chat" element={<ChatPage />} /> */}
          {/* <Route path="/profile" element={<ProfilePage />} /> */}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
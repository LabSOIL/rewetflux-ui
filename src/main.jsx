import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import FrontendApp from './App';
import Landing from './pages/Landing';
import './index.css';
import { applyTheme } from './theme';
import { RouterProvider, Routes, Route, createBrowserRouter } from 'react-router-dom';

export const App = () => {
    const router = createBrowserRouter(
        [
            {
                path: "*",
                element: (
                    <Routes>
                        <Route path="/" element={<Landing />} />
                        <Route path="/map" element={<FrontendApp />} />
                    </Routes>
                ),
            },
        ],
    );
    return <RouterProvider router={router} />;
};


applyTheme();

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>
)

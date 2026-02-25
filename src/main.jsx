import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import FrontendApp from './App';
import './index.css';
import { RouterProvider, Routes, Route, createBrowserRouter } from 'react-router-dom';

export const App = () => {
    const router = createBrowserRouter(
        [
            {
                path: "*",
                element: (
                    <Routes>
                        <Route path="/" element={<FrontendApp />} />
                    </Routes>
                ),
            },
        ],
    );
    return <RouterProvider router={router} />;
};


createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>
)

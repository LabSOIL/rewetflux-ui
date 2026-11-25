import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import FrontendApp from './App';
import Landing from './pages/Landing';
import './index.css';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { FONT, applyTheme } from './theme';
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

// The MUI components (chips, sliders, the panels' titles) in the interface's typeface, not their own default.
const muiTheme = createTheme({ typography: { fontFamily: FONT } });

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ThemeProvider theme={muiTheme}>
            <App />
        </ThemeProvider>
    </StrictMode>
)

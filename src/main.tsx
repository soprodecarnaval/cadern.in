import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './tsx/App.js'
import './main.css'

import 'bootstrap/dist/css/bootstrap.css';
import { app } from './firebase.js';
console.log('Firebase app initialized:', app.name, app.options.projectId);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./tsx/App";
import "./main.css";

import "bootstrap/dist/css/bootstrap.css";
import { app } from "./firebase";
import { AuthProvider } from "./auth";
import { CollectionProvider } from "./CollectionContext";
console.log("Firebase app initialized:", app.name, app.options.projectId);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CollectionProvider>
          <App />
        </CollectionProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

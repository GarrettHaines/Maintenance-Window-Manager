import { Page } from "@dynatrace/strato-components-preview";
import React from "react";
import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { MaintenanceWindowManager } from "./pages/MaintenanceWindowManager";

export const App = () => {
  return (
    <Page>
      <Page.Header>
        <Header />
      </Page.Header>
      <Page.Main>
        <Routes>
          <Route path="/" element={<MaintenanceWindowManager />} />
        </Routes>
      </Page.Main>
    </Page>
  );
};
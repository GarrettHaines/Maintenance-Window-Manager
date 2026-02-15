import { Page } from "@dynatrace/strato-components-preview";
import React from "react";
import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { MaintenanceWindows } from "./pages/MaintenanceWindows";

export const App = () => {
  return (
    <Page>
      <Page.Header>
        <Header />
      </Page.Header>
      <Page.Main>
        <Routes>
          <Route path="/" element={<MaintenanceWindows />} />
        </Routes>
      </Page.Main>
    </Page>
  );
};
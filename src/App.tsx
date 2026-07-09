/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Routes, Route } from 'react-router-dom';
import { RegistrationForm } from './presentation/pages/RegistrationForm.tsx';
import { AdminDashboard } from './presentation/pages/AdminDashboard.tsx';
import { SuccessPage } from './presentation/pages/SuccessPage.tsx';

import { LanguageSwitcher } from './presentation/components/LanguageSwitcher.tsx';

export default function App() {
  return (
    <>
      <LanguageSwitcher />
      <Routes>
        <Route path="/" element={<RegistrationForm />} />
        <Route path="/success/:id" element={<SuccessPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </>
  );
}

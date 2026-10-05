import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Summary from './pages/Summary';
import PartiesList from './pages/PartiesList';
import PartyLedger from './pages/PartyLedger';
import DispatchForm from './pages/DispatchForm';
import Settings from './pages/Settings';
import AllEntries from './pages/AllEntries';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Summary />} />
          <Route path="parties" element={<PartiesList />} />
          <Route path="parties/:partyId" element={<PartyLedger />} />
          <Route path="parties/:partyId/dispatch/:dispatchId" element={<DispatchForm />} />
          <Route path="entries" element={<AllEntries />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

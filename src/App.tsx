import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import HomeScreen from "./screens/HomeScreen";
import ReaderScreen from "./screens/ReaderScreen";
import SearchScreen from "./screens/SearchScreen";
import BookmarksScreen from "./screens/BookmarksScreen";
import ChatListScreen from "./screens/ChatListScreen";
import ChatScreen from "./screens/ChatScreen";
import SettingsScreen from "./screens/SettingsScreen";
import AboutScreen from "./screens/AboutScreen";
import LearnScreen from "./screens/LearnScreen";
import ExploreScreen from "./screens/ExploreScreen";
import ComingSoonScreen from "./screens/ComingSoonScreen";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/lesen" element={<ReaderScreen />} />
        <Route path="/lesen/:osis/:kapitel" element={<ReaderScreen />} />
        <Route path="/suche" element={<SearchScreen />} />
        <Route path="/lesezeichen" element={<BookmarksScreen />} />
        <Route path="/chat" element={<ChatListScreen />} />
        <Route path="/chat/:id" element={<ChatScreen />} />
        <Route path="/lernen" element={<LearnScreen />} />
        <Route path="/erforschen" element={<ExploreScreen />} />
        <Route path="/spiele" element={<ComingSoonScreen titel="BibelSpiele" />} />
        <Route path="/leseplan" element={<ComingSoonScreen titel="Leseplan" />} />
        <Route path="/einstellungen" element={<SettingsScreen />} />
        <Route path="/ueber" element={<AboutScreen />} />
      </Route>
    </Routes>
  );
}

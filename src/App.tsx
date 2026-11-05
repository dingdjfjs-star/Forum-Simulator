import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import BoardList from './pages/BoardList';
import PostList from './pages/PostList';
import PostDetail from './pages/PostDetail';
import CreatePost from './pages/CreatePost';
import CharacterList from './pages/CharacterList';
import CharacterForm from './pages/CharacterForm';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import Admin from './pages/Admin';
import { SeriesList, SeriesDetail } from './pages/Series';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<BoardList />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/board/:boardId" element={<PostList />} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/create-post" element={<CreatePost />} />
        <Route path="/create-post/:boardId" element={<CreatePost />} />
        <Route path="/characters" element={<CharacterList />} />
        <Route path="/create-character" element={<CharacterForm />} />
        <Route path="/edit-character/:id" element={<CharacterForm />} />
        <Route path="/series" element={<SeriesList />} />
        <Route path="/series/:id" element={<SeriesDetail />} />
        <Route path="/user/:id" element={<UserProfile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}

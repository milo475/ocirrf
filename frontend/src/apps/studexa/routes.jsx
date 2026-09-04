import { Navigate, Route, Routes } from 'react-router'
import PermRoute from '../../components/auth/PermRoute'
import Academics from './pages/Academics'
import Announcements from './pages/Announcements'
import Attendance from './pages/Attendance'
import Dashboard from './pages/Dashboard'
import Gradebook from './pages/Gradebook'
import GroupDetail from './pages/GroupDetail'
import Home from './pages/Home'
import Homework from './pages/Homework'
import HomeworkForm from './pages/HomeworkForm'
import LessonForm from './pages/LessonForm'
import Notes from './pages/Notes'
import Portal from './pages/Portal'
import Schedule from './pages/Schedule'
import Setup from './pages/Setup'
import StudentDetail from './pages/StudentDetail'
import StudentForm from './pages/StudentForm'
import Students from './pages/Students'
import TeacherSettings from './pages/TeacherSettings'

/**
 * STUDEXA route мод — "/studexa/*" дор ХАРЬЦАНГУЙ замууд. Энэ файл lazy
 * chunk-ийн entry (манифестийн loadRoutes) тул энд import хийгдсэн бүх
 * хуудас app-studexa-*.js-д орно.
 */
export default function StudexaRoutes() {
  return (
    <Routes>
      {/* Нүүр: багш → самбар (профайлгүй бол setup), сурагч → портал */}
      <Route index element={<Home />} />
      <Route element={<PermRoute perm="studexa.teach" />}>
        <Route path="setup" element={<Setup />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="students/new" element={<StudentForm />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="students/:id/edit" element={<StudentForm />} />
        <Route path="groups/:name" element={<GroupDetail />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="gradebook" element={<Gradebook />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="schedule/new" element={<LessonForm />} />
        <Route path="schedule/:id/edit" element={<LessonForm />} />
        <Route path="homework" element={<Homework />} />
        <Route path="homework/new" element={<HomeworkForm />} />
        <Route path="academics" element={<Academics />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="notes" element={<Notes />} />
        <Route path="settings" element={<TeacherSettings />} />
      </Route>
      <Route element={<PermRoute perm="studexa.portal" />}>
        <Route path="portal" element={<Portal />} />
      </Route>
      <Route path="*" element={<Navigate to="/studexa" replace />} />
    </Routes>
  )
}

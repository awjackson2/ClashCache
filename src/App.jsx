import './App.css'
import UnderDevlopment from './components/UnderDevelopment'
import { HashRouter, Routes, Route} from 'react-router-dom'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<UnderDevlopment/>}></Route>
      </Routes>
    </HashRouter>
  )
}

export default App

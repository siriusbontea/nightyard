import { render } from 'preact'
import { App } from './components/App'
import { startInstallCapture } from './install'
import { bindVisibleViewport } from './viewport'

bindVisibleViewport()
startInstallCapture()
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/oswald/latin-500.css'
import '@fontsource/oswald/latin-600.css'
import '@fontsource/graduate/latin-400.css'
import './styles.css'

const root = document.getElementById('app')
if (root) render(<App />, root)

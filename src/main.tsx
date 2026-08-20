import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './styles.css'
import './pages.css'
import './workspace.css'
import './brand.css'
import './app-theme.css'
import './sidebar-responsive.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } })
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><App /></BrowserRouter></QueryClientProvider></React.StrictMode>)

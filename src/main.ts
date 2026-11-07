import { mount } from 'svelte';
import App from './App.svelte';
import '@tabler/core/dist/css/tabler.min.css';
import './style.css';
mount(App, { target: document.getElementById('app')! });

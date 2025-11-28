import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [data, setData] = useState({
    webcam: { active: false, apps: [] },
    mic: { active: false, apps: [] },
    usb: { count: 0, devices: [] },
    processes: [],
    network: { upload: 0, download: 0 },
    ports: []
  });

  const [portSearch, setPortSearch] = useState("");

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onPythonData((jsonString) => {
        try {
          const parsed = JSON.parse(jsonString);
          if (parsed.type === 'hardware_update') {
            setData(parsed);
          }
        } catch (e) { }
      });
    }
  }, []);

  const handleKillProcess = (pid) => {
    // --- MODO SEGURO (ATIVO) ---
    alert(`Tem certeza? Para ativar essa função, descomente o código no App.jsx.\nPara matar o processo ${pid}, rode: taskkill /F /PID ${pid}`);

    // --- MODO NUCLEAR (COMENTADO PARA SEGURANÇA) ---
    // if (window.confirm(`Deseja realmente encerrar forçadamente o processo PID ${pid}?`)) {
    //    window.electronAPI.killProcess(pid);
    // }
  };

  const filteredPorts = data.ports.filter(p => 
    p.port.toString().includes(portSearch) || 
    p.name.toLowerCase().includes(portSearch.toLowerCase())
  );

  return (
    <div className="container">
      <header>
        <h1>TECH<span className="accent">SENTINEL</span></h1>
        <div style={{display:'flex', gap:'15px'}}>
          <div className="net-stats">
            <div className="net-item" style={{marginRight:'15px'}}>
              <span className="net-val down">↓ {data.network.download.toFixed(1)} KB/s</span>
            </div>
            <div className="net-item">
              <span className="net-val up">↑ {data.network.upload.toFixed(1)} KB/s</span>
            </div>
          </div>
        </div>
      </header>

      <div className="main-grid">
        <div className="left-panel">
          
          {/* HARDWARE CARDS CORRIGIDOS */}
          <div className="card-row">
            {/* WEBCAM */}
            <div className={`card ${data.webcam.active ? 'danger' : 'safe'}`}>
              <div className="card-header">📷 CAM</div>
              <div className="status-text">{data.webcam.active ? 'EM USO' : 'SEGURA'}</div>
              {/* Lista os Apps da Webcam */}
              {data.webcam.active && data.webcam.apps.map((app, i) => (
                <div key={i} className="app-tag">{app}</div>
              ))}
            </div>

            {/* MICROFONE */}
            <div className={`card ${data.mic.active ? 'danger' : 'safe'}`}>
              <div className="card-header">🎤 MIC</div>
              <div className="status-text">{data.mic.active ? 'EM USO' : 'SEGURO'}</div>
              {/* Lista os Apps do Microfone */}
              {data.mic.active && data.mic.apps.map((app, i) => (
                <div key={i} className="app-tag">{app}</div>
              ))}
            </div>

            {/* USB */}
            <div className={`card ${data.usb.count > 0 ? 'warning' : 'neutral'}`}>
              <div className="card-header">🔌 USB</div>
              <div className="status-text">{data.usb.count}</div>
              {/* Lista os USBs */}
              {data.usb.count > 0 && data.usb.devices.map((dev, i) => (
                <div key={i} className="usb-tag" style={{display:'block', marginTop:'5px'}}>
                  {dev.name}
                </div>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <div className="card-header" style={{marginBottom:'10px'}}>TOP CPU CONSUMPTION</div>
            <div className="scroll-area">
              <table>
                <thead>
                  <tr>
                    <th>PID</th>
                    <th>NOME</th>
                    <th>CPU</th>
                    <th>MEM</th>
                  </tr>
                </thead>
                <tbody>
                  {data.processes.map((proc) => (
                    <tr key={proc.pid}>
                      <td className="mono">{proc.pid}</td>
                      <td>{proc.name}</td>
                      <td style={{width: '120px'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                          <span>{proc.cpu_percent.toFixed(0)}%</span>
                          <div className="bar-bg">
                            <div className="bar-fill" style={{width: `${Math.min(proc.cpu_percent, 100)}%`}}></div>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{proc.memory_percent.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="right-panel">
          <div className="panel-section">
            <div className="card-header">🔎 PORT FINDER & KILLER</div>
            <input 
              type="text" 
              className="search-box"
              placeholder="Buscar porta (ex: 8080) ou nome..."
              value={portSearch}
              onChange={(e) => setPortSearch(e.target.value)}
            />
            
            <div className="scroll-area">
              {filteredPorts.length === 0 ? (
                <div style={{color:'#666', textAlign:'center', marginTop:'20px'}}>
                  {portSearch ? "Nenhuma porta encontrada." : "Digite para buscar..."}
                </div>
              ) : (
                filteredPorts.map((p, i) => (
                  <div key={i} className="port-item">
                    <div className="port-info">
                      <span className="port-number">:{p.port}</span>
                      <span className="port-name">{p.name} (PID: {p.pid})</span>
                    </div>
                    {/* Botão de kill */}
                    <button 
                      className="kill-btn"
                      onClick={() => handleKillProcess(p.pid)}
                    >
                      KILL
                    </button>
                  </div>
                ))
              )}
            </div>
            <div style={{marginTop: '10px', fontSize:'0.7em', color:'#555'}}>
              *Mostrando apenas portas TCP em LISTEN.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
import sys
import time
import json
import winreg
import pythoncom 
import wmi
import psutil

# Variáveis globais para calcular velocidade de rede
last_net_io = psutil.net_io_counters()
last_time = time.time()

def send_to_node(data):
    try:
        print(json.dumps(data))
        sys.stdout.flush()
    except: pass

def get_network_speed():
    global last_net_io, last_time
    
    current_net_io = psutil.net_io_counters()
    current_time = time.time()
    
    # Calcula a diferença (bytes recebidos/enviados desde a última checagem)
    elapsed = current_time - last_time
    if elapsed == 0: elapsed = 1 # Evita divisão por zero
    
    bytes_sent = current_net_io.bytes_sent - last_net_io.bytes_sent
    bytes_recv = current_net_io.bytes_recv - last_net_io.bytes_recv
    
    # Atualiza para a próxima volta
    last_net_io = current_net_io
    last_time = current_time
    
    # Retorna em KB/s
    return {
        "upload": bytes_sent / 1024 / elapsed,
        "download": bytes_recv / 1024 / elapsed
    }

def get_listening_ports():
    """Retorna lista de portas que estão 'ouvindo' (servidores rodando)."""
    connections = []
    try:
        # Pega apenas conexões TCP e inet (IPv4)
        for conn in psutil.net_connections(kind='inet'):
            if conn.status == 'LISTEN' and conn.laddr:
                try:
                    proc = psutil.Process(conn.pid)
                    connections.append({
                        "pid": conn.pid,
                        "port": conn.laddr.port,
                        "name": proc.name()
                    })
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
    except: pass
    return connections

def get_top_processes():
    processes = []
    try:
        # psutil.cpu_count() ajuda a normalizar se necessário, mas foco em filtrar o Idle
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                p_info = proc.info
                # FILTRO 1: Ignorar System Idle Process (que é apenas tempo ocioso)
                if p_info['name'] == 'System Idle Process':
                    continue
                
                # FILTRO 2: Ignorar processos com 0% de uso para limpar a lista
                if p_info['cpu_percent'] > 0.1: 
                    # Dividido pelo count lógico para normalizar em 100% total do sistema
                    # mas o padrão do Task Manager é soma dos cores. manter o padrão, mas travar visualmente no front.
                    processes.append(p_info)
            except: pass
        
        # Ordena e pega Top 10
        top_cpu = sorted(processes, key=lambda p: p['cpu_percent'], reverse=True)[:10]
        return top_cpu
    except: return []

# ----------------------------------------------
def get_usb_devices():
    usb_list = []
    try:
        pythoncom.CoInitialize() 
        c = wmi.WMI()
        for drive in c.Win32_DiskDrive(InterfaceType="USB"):
            size_gb = float(drive.Size) / (1024**3) if drive.Size else 0
            usb_list.append({"name": drive.Caption, "size": f"{size_gb:.2f} GB"})
    except: pass
    return usb_list

def get_apps_using_device(device_type):
    active_apps = []
    base_path = f"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\{device_type}"
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, base_path)
        i = 0
        while True:
            try:
                subkey_name = winreg.EnumKey(key, i)
                i += 1
                subkey_path = f"{base_path}\\{subkey_name}"
                if subkey_name == "NonPackaged":
                    subkey = winreg.OpenKey(winreg.HKEY_CURRENT_USER, subkey_path)
                    j = 0
                    while True:
                        try:
                            app_name_raw = winreg.EnumKey(subkey, j)
                            j += 1
                            if check_app_status(subkey_path + "\\" + app_name_raw):
                                clean_name = app_name_raw.split('#')[-1].replace('.exe', '')
                                active_apps.append(clean_name)
                        except OSError: break
                    winreg.CloseKey(subkey)
                else:
                    if check_app_status(subkey_path): active_apps.append(subkey_name)
            except OSError: break
        winreg.CloseKey(key)
    except: return []
    return active_apps

def check_app_status(reg_path):
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, reg_path)
        value, type = winreg.QueryValueEx(key, "LastUsedTimeStop")
        winreg.CloseKey(key)
        return value == 0
    except: return False
# ----------------------------------------------

def main():
    while True:
        data = {
            "type": "hardware_update",
            "webcam": { "active": False, "apps": [] },
            "mic": { "active": False, "apps": [] },
            "usb": { "count": 0, "devices": [] },
            "processes": [],
            "network": { "upload": 0, "download": 0 },
            "ports": [],
            "timestamp": time.time()
        }

        try: data["webcam"]["apps"] = get_apps_using_device('webcam')
        except: pass
        data["webcam"]["active"] = len(data["webcam"]["apps"]) > 0

        try: data["mic"]["apps"] = get_apps_using_device('microphone')
        except: pass
        data["mic"]["active"] = len(data["mic"]["apps"]) > 0

        try: 
            usb_devs = get_usb_devices()
            data["usb"] = { "count": len(usb_devs), "devices": usb_devs }
        except: pass

        try: data["processes"] = get_top_processes()
        except: pass
        
        try: data["network"] = get_network_speed()
        except: pass

        # Portas são pesadas de listar, listar a cada 2 loops ou sempre -- por conta de performance
        try: data["ports"] = get_listening_ports()
        except: pass
        
        send_to_node(data)
        time.sleep(1.5)

if __name__ == "__main__":
    main()
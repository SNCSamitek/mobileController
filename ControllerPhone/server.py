from flask import Flask, render_template
from flask_sock import Sock
import json

app = Flask(__name__)
sock = Sock(app)

connected_clients = set()

@app.route("/")
def home():
    return render_template("xboxController.html")

@sock.route('/ws')
def websocket(ws):
    connected_clients.add(ws)
    print(f"Client connected. Total clients: {len(connected_clients)}")
    
    try:
        while True:
            data = ws.receive()
            if data:
                for client in connected_clients:
                    if client != ws:
                        try:
                            client.send(data)
                        except:
                            pass
                
    except Exception as e:
        print(f"Connection closed: {e}")
    finally:
        connected_clients.discard(ws)
        print(f"Client disconnected. Total clients: {len(connected_clients)}")

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)
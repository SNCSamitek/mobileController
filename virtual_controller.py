import asyncio
import websockets
import json
import vgamepad as vg
import time

class VirtualController:
    def __init__(self):
        self.gamepad = vg.VX360Gamepad()
        
        self.face_button_map = {
            'a': vg.XUSB_BUTTON.XUSB_GAMEPAD_A,
            'b': vg.XUSB_BUTTON.XUSB_GAMEPAD_B,
            'x': vg.XUSB_BUTTON.XUSB_GAMEPAD_X,
            'y': vg.XUSB_BUTTON.XUSB_GAMEPAD_Y,
        }
        
        self.dpad_button_map = {
            'up': vg.XUSB_BUTTON.XUSB_GAMEPAD_DPAD_UP,
            'down': vg.XUSB_BUTTON.XUSB_GAMEPAD_DPAD_DOWN,
            'left': vg.XUSB_BUTTON.XUSB_GAMEPAD_DPAD_LEFT,
            'right': vg.XUSB_BUTTON.XUSB_GAMEPAD_DPAD_RIGHT,
        }
        
        self.pressed_face_buttons = set()
        self.pressed_dpad_buttons = set()
        
    def update_state(self, controller_state):
        """Update the virtual controller based on received state"""
        
        left_x = controller_state['leftStick']['x']
        left_y = controller_state['leftStick']['y']
        self.gamepad.left_joystick_float(x_value_float=left_x, y_value_float=left_y)
        
        right_x = controller_state['rightStick']['x']
        right_y = controller_state['rightStick']['y']
        self.gamepad.right_joystick_float(x_value_float=right_x, y_value_float=right_y)
        
        if controller_state['L1']:
            self.gamepad.press_button(vg.XUSB_BUTTON.XUSB_GAMEPAD_LEFT_SHOULDER)
        else:
            self.gamepad.release_button(vg.XUSB_BUTTON.XUSB_GAMEPAD_LEFT_SHOULDER)
            
        if controller_state['R1']:
            self.gamepad.press_button(vg.XUSB_BUTTON.XUSB_GAMEPAD_RIGHT_SHOULDER)
        else:
            self.gamepad.release_button(vg.XUSB_BUTTON.XUSB_GAMEPAD_RIGHT_SHOULDER)
        
        left_trigger = 255 if controller_state['L2'] else 0
        right_trigger = 255 if controller_state['R2'] else 0
        self.gamepad.left_trigger(left_trigger)
        self.gamepad.right_trigger(right_trigger)
        
        current_face_buttons = set(controller_state['faceButtons'])
        
        for button in current_face_buttons - self.pressed_face_buttons:
            if button in self.face_button_map:
                self.gamepad.press_button(self.face_button_map[button])
        
        for button in self.pressed_face_buttons - current_face_buttons:
            if button in self.face_button_map:
                self.gamepad.release_button(self.face_button_map[button])
        
        self.pressed_face_buttons = current_face_buttons
        
        current_dpad_buttons = set(controller_state['DPadButtons'])
        
        for button in current_dpad_buttons - self.pressed_dpad_buttons:
            if button in self.dpad_button_map:
                self.gamepad.press_button(self.dpad_button_map[button])
        
        for button in self.pressed_dpad_buttons - current_dpad_buttons:
            if button in self.dpad_button_map:
                self.gamepad.release_button(self.dpad_button_map[button])
        
        self.pressed_dpad_buttons = current_dpad_buttons
        
        self.gamepad.update()

async def connect_to_server(server_url):
    """Connect to Flask WebSocket server and translate inputs"""
    controller = VirtualController()
    print(f"Virtual Xbox 360 controller created!")
    print(f"Connecting to {server_url}...")
    
    while True:
        try:
            async with websockets.connect(server_url) as websocket:
                print("Connected to server!")
                print("Ready to receive controller inputs...")
                
                async for message in websocket:
                    try:
                        controller_state = json.loads(message)
                        controller.update_state(controller_state)
                    except json.JSONDecodeError as e:
                        print(f"Error decoding message: {e}")
                    except Exception as e:
                        print(f"Error updating controller: {e}")
                        
        except websockets.exceptions.ConnectionClosed:
            print("Connection closed. Reconnecting in 3 seconds...")
            await asyncio.sleep(3)
        except Exception as e:
            print(f"Connection error: {e}")
            print("Retrying in 3 seconds...")
            await asyncio.sleep(3)

if __name__ == "__main__":
    SERVER_URL = "ws://localhost:5000/ws"
    
    print("=" * 50)
    print("Virtual Controller Input Client")
    print("=" * 50)
    print()
    
    try:
        asyncio.run(connect_to_server(SERVER_URL))
    except KeyboardInterrupt:
        print("\nShutting down...")
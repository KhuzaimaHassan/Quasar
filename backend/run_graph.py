import uuid
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents.main_graph import graph

def run():
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        print("Starting graph...")
        for event in graph.stream({
            "task": "write a python code for scientific calculator",
            "conversation_id": "test_conv",
            "workspace_id": "test_workspace",
            "execution_target": "sandbox"
        }, config):
            print(event)
            
        print("Interrupt reached or finished.")
        state = graph.get_state(config)
        print("State:", state)
        
    except Exception as e:
        print(f"Graph failed with error: {e}")
        
if __name__ == "__main__":
    run()

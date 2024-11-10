#!/usr/bin/env python3
import argparse
import json
import requests
import uuid
from datetime import datetime
import sys
from typing import Dict, List, Optional
import time
from dataclasses import dataclass
from colorama import Fore, Style, init

# Initialize colorama for cross-platform colored output
init(autoreset=True)

@dataclass
class Session:
    id: str
    created_rules: List[str]
    start_time: float

def create_test_rule_1():
    """Create a test rule that matches the existing rule structure"""
    return {
        "version": 0,
        "name": "Test URL Hostname Rate Limit",
        "description": "Rate limit test for hostname matching",
        "rateLimit": {
            "limit": 100,
            "period": 60
        },
        "fingerprint": {
            "parameters": [
                {
                    "name": "url.hostname"
                }
            ]
        },
        "initialMatch": {
            "conditions": [
                {
                    "field": "url.hostname",
                    "operator": "eq",
                    "value": "httpbun-nl.erfianugrah.com"
                }
            ],
            "action": {
                "type": "rateLimit"
            }
        },
        "elseIfActions": [],
        "id": str(uuid.uuid4()),
        "order": 3
    }

def create_test_rule_2():
    """Create another test rule that matches the existing rule structure"""
    return {
        "version": 0,
        "name": "Test Bot Protection",
        "description": "Rate limit test for method matching",
        "rateLimit": {
            "limit": 10,
            "period": 600
        },
        "fingerprint": {
            "parameters": [
                {
                    "name": "clientIP"
                }
            ]
        },
        "initialMatch": {
            "conditions": [
                {
                    "field": "method",
                    "operator": "eq",
                    "value": "POST"
                }
            ],
            "action": {
                "type": "rateLimit"
            }
        },
        "elseIfActions": [],
        "id": str(uuid.uuid4()),
        "order": 4
    }

def create_test_rule_update(rule_id: str, order: int):
    """Create an update for a test rule"""
    return {
        "version": 1,
        "name": "Test URL Update",
        "description": "Test updating URL rule",
        "rateLimit": {
            "limit": 123,
            "period": 10
        },
        "fingerprint": {
            "parameters": [
                {
                    "name": "url"
                },
                {
                    "name": "headers.name",
                    "headerName": "456"
                }
            ]
        },
        "initialMatch": {
            "conditions": [
                {
                    "field": "url",
                    "operator": "starts_with",
                    "value": "www"
                }
            ],
            "action": {
                "type": "rateLimit"
            }
        },
        "elseIfActions": [],
        "id": rule_id,
        "order": order
    }

class RateLimiterApiSimulator:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.sessions: Dict[str, Session] = {}
        self.current_session: Optional[str] = None

    def create_session(self) -> str:
        """Create a new testing session."""
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = Session(
            id=session_id,
            created_rules=[],
            start_time=time.time()
        )
        self.current_session = session_id
        print(f"{Fore.GREEN}Created new session: {session_id}")
        return session_id

    def get_headers(self) -> dict:
        """Get headers including session identifier."""
        headers = {
            "Content-Type": "application/json",
            "rate-limiter-configurator": f"simulator-{self.current_session[:8]}" if self.current_session else "simulator"
        }
        return headers

    def switch_session(self, session_id: str) -> None:
        """Switch to a different testing session."""
        if session_id not in self.sessions:
            print(f"{Fore.RED}Session {session_id} not found")
            return
        self.current_session = session_id
        print(f"{Fore.GREEN}Switched to session: {session_id}")

    def _get_current_session(self) -> Optional[Session]:
        if not self.current_session:
            print(f"{Fore.RED}No active session. Create one first.")
            return None
        return self.sessions.get(self.current_session)

    def create_rule(self, rule_data: dict) -> Optional[str]:
        """Create a new rate limiting rule."""
        session = self._get_current_session()
        if not session:
            return None

        try:
            response = requests.post(
                f"{self.base_url}/config",
                json=rule_data,
                headers=self.get_headers()
            )
            response.raise_for_status()
            rule = response.json()
            rule_id = rule.get('id')
            if rule_id:
                session.created_rules.append(rule_id)
                print(f"{Fore.GREEN}Created rule: {rule_id}")
                print(f"{Fore.YELLOW}Response: {json.dumps(rule, indent=2)}")
                return rule_id
        except requests.exceptions.RequestException as e:
            print(f"{Fore.RED}Error creating rule: {str(e)}")
            if hasattr(e.response, 'text'):
                print(f"{Fore.RED}Response: {e.response.text}")
        return None

    def get_rules(self) -> Optional[List[dict]]:
        """Get all rate limiting rules."""
        try:
            response = requests.get(
                f"{self.base_url}/config",
                headers=self.get_headers()
            )
            response.raise_for_status()
            rules = response.json().get('rules', [])
            print(f"{Fore.GREEN}Retrieved {len(rules)} rules")
            return rules
        except requests.exceptions.RequestException as e:
            print(f"{Fore.RED}Error getting rules: {str(e)}")
            if hasattr(e.response, 'text'):
                print(f"{Fore.RED}Response: {e.response.text}")
        return None

    def update_rule(self, rule_id: str, rule_data: dict) -> bool:
        """Update an existing rate limiting rule."""
        try:
            current_rules = self.get_rules()
            current_rule = next((r for r in current_rules if r['id'] == rule_id), None)
            if not current_rule:
                print(f"{Fore.RED}Rule {rule_id} not found")
                return False

            # Merge current rule with update data
            update_data = {**current_rule, **rule_data}

            response = requests.put(
                f"{self.base_url}/rules/{rule_id}",
                json=update_data,
                headers=self.get_headers()
            )
            response.raise_for_status()
            result = response.json()
            print(f"{Fore.GREEN}Updated rule: {rule_id}")
            print(f"{Fore.YELLOW}Response: {json.dumps(result, indent=2)}")
            return True
        except requests.exceptions.RequestException as e:
            print(f"{Fore.RED}Error updating rule: {str(e)}")
            if hasattr(e.response, 'text'):
                print(f"{Fore.RED}Response: {e.response.text}")
        return False

    def delete_rule(self, rule_id: str) -> bool:
        """Delete a rate limiting rule."""
        session = self._get_current_session()
        if not session:
            return False

        try:
            response = requests.delete(
                f"{self.base_url}/rules/{rule_id}",
                headers=self.get_headers()
            )
            response.raise_for_status()
            if rule_id in session.created_rules:
                session.created_rules.remove(rule_id)
            print(f"{Fore.GREEN}Deleted rule: {rule_id}")
            return True
        except requests.exceptions.RequestException as e:
            print(f"{Fore.RED}Error deleting rule: {str(e)}")
            if hasattr(e.response, 'text'):
                print(f"{Fore.RED}Response: {e.response.text}")
        return False

    def reorder_rules(self, rule_ids: List[str]) -> bool:
        """Reorder rate limiting rules."""
        try:
            current_rules = self.get_rules()
            if not current_rules:
                return False

            # Create reorder payload with full rule objects
            reordered_rules = []
            for idx, rule_id in enumerate(rule_ids):
                rule = next((r for r in current_rules if r['id'] == rule_id), None)
                if rule:
                    rule['order'] = idx
                    reordered_rules.append(rule)

            response = requests.put(
                f"{self.base_url}/config/reorder",
                json={"rules": reordered_rules},
                headers=self.get_headers()
            )
            response.raise_for_status()
            print(f"{Fore.GREEN}Rules reordered successfully")
            print(f"{Fore.YELLOW}Response: {json.dumps(response.json(), indent=2)}")
            return True
        except requests.exceptions.RequestException as e:
            print(f"{Fore.RED}Error reordering rules: {str(e)}")
            if hasattr(e.response, 'text'):
                print(f"{Fore.RED}Response: {e.response.text}")
        return False

    def cleanup_session(self, session_id: Optional[str] = None) -> None:
        """Clean up rules created in a specific session or the current session."""
        if session_id:
            session = self.sessions.get(session_id)
        else:
            session = self._get_current_session()

        if not session:
            return

        print(f"{Fore.YELLOW}Cleaning up session: {session.id}")
        for rule_id in session.created_rules[:]:
            self.delete_rule(rule_id)

        if session_id:
            del self.sessions[session_id]
            if self.current_session == session_id:
                self.current_session = None
            print(f"{Fore.GREEN}Session {session_id} cleaned up and removed")

    def cleanup_all_sessions(self) -> None:
        """Clean up all testing sessions."""
        print(f"{Fore.YELLOW}Cleaning up all sessions")
        for session_id in list(self.sessions.keys()):
            self.cleanup_session(session_id)
        print(f"{Fore.GREEN}All sessions cleaned up")

    def get_session_info(self, session_id: Optional[str] = None) -> None:
        """Display information about a specific session or the current session."""
        if session_id:
            session = self.sessions.get(session_id)
        else:
            session = self._get_current_session()

        if not session:
            return

        print(f"\n{Fore.CYAN}Session Information:")
        print(f"Session ID: {session.id}")
        print(f"Created: {datetime.fromtimestamp(session.start_time).strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Rules created: {len(session.created_rules)}")
        print("Rule IDs:")
        for rule_id in session.created_rules:
            print(f"  - {rule_id}")
def main():
    parser = argparse.ArgumentParser(description="Rate Limiter API Simulator")
    parser.add_argument("--url", required=True, help="Base URL of the Rate Limiter API")
    args = parser.parse_args()

    simulator = RateLimiterApiSimulator(args.url)

    print(f"{Fore.CYAN}Rate Limiter API Simulator")
    print(f"Base URL: {args.url}\n")

    # Create test sessions
    session1 = simulator.create_session()
    session2 = simulator.create_session()

    # Get current rules
    print("\nFetching current rules...")
    current_rules = simulator.get_rules()
    next_order = 0
    if current_rules:
        print(f"\n{Fore.CYAN}Current Rules:")
        print(json.dumps(current_rules, indent=2))
        next_order = max(rule["order"] for rule in current_rules) + 1

    # Create test rules in session 1
    simulator.switch_session(session1)
    rule1_data = create_test_rule_1()
    rule1 = simulator.create_rule(rule1_data)

    if rule1:
        print("\nUpdating rule...")
        update_data = create_test_rule_update(rule1, rule1_data["order"])
        simulator.update_rule(rule1, update_data)

    # Create test rules in session 2
    simulator.switch_session(session2)
    rule2_data = create_test_rule_2()
    rule2 = simulator.create_rule(rule2_data)

    # Test reordering if both rules were created
    if rule1 and rule2:
        print("\nReordering rules...")
        current_rules = simulator.get_rules()
        if current_rules:
            # Move our new rules to the front
            rule_ids = [r['id'] for r in current_rules]
            if rule1 in rule_ids:
                rule_ids.remove(rule1)
                rule_ids.insert(0, rule1)
            if rule2 in rule_ids:
                rule_ids.remove(rule2)
                rule_ids.insert(0, rule2)
            simulator.reorder_rules(rule_ids)

    # Display session information
    simulator.get_session_info(session1)
    simulator.get_session_info(session2)

    # Clean up all sessions
    print("\nCleaning up...")
    simulator.cleanup_all_sessions()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}Simulation interrupted by user")
        sys.exit(0)

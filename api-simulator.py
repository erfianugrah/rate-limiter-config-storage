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
from concurrent.futures import ThreadPoolExecutor
import random
import signal
from threading import Lock

# Initialize colorama for cross-platform colored output
init(autoreset=True)

# Constants
SESSION_HEADER_NAME = "rate-limiter-configurator"

@dataclass
class Session:
    id: str
    created_rules: List[str]
    start_time: float

def create_test_rule_1():
    """Create a test rule that matches the existing rule structure"""
    limit_value = 100
    return {
        "version": 0,
        "name": "Test URL Hostname Rate Limit",
        "description": "Rate limit test for hostname matching",
        "rateLimit": {
            "limit": limit_value,
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
                    "operator": "equals",
                    "value": "httpbun-nl.erfianugrah.com"
                }
            ],
            "action": {
                "type": "rateLimit",
                "limit": limit_value
            }
        },
        "elseIfActions": [],
        "id": str(uuid.uuid4()),
        "order": 3
    }

def create_test_rule_2():
    """Create another test rule that matches the existing rule structure"""
    limit_value = 10
    return {
        "version": 0,
        "name": "Test Bot Protection",
        "description": "Rate limit test for method matching",
        "rateLimit": {
            "limit": limit_value,
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
                    "operator": "equals",
                    "value": "POST"
                }
            ],
            "action": {
                "type": "rateLimit",
                "limit": limit_value
            }
        },
        "elseIfActions": [],
        "id": str(uuid.uuid4()),
        "order": 4
    }

def create_test_rule_update(rule_id: str, order: int):
    """Create an update for a test rule"""
    limit_value = 123
    return {
        "version": 1,
        "name": "Test URL Update",
        "description": "Test updating URL rule",
        "rateLimit": {
            "limit": limit_value,
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
                    "operator": "startsWith",
                    "value": "www"
                }
            ],
            "action": {
                "type": "rateLimit",
                "limit": limit_value
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
        self.session_lock = Lock()

    def create_session(self) -> str:
        """Create a new testing session with thread safety."""
        session_id = str(uuid.uuid4())
        with self.session_lock:
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
        session_value = (f"simulator-{self.current_session[:8]}"
                      if self.current_session
                      else "simulator")
        headers = {
            "Content-Type": "application/json",
            SESSION_HEADER_NAME: session_value
        }
        return headers

    def switch_session(self, session_id: str) -> None:
        """Switch to a different testing session with thread safety."""
        with self.session_lock:
            if session_id not in self.sessions:
                print(f"{Fore.RED}Session {session_id} not found")
                return
            self.current_session = session_id
            print(f"{Fore.GREEN}Switched to session: {session_id}")

    def _get_current_session(self) -> Optional[Session]:
        """Get current session with thread safety."""
        with self.session_lock:
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
                with self.session_lock:
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

    def delete_rule(self, rule_id: str, session_id: Optional[str] = None) -> bool:
        """Delete a rate limiting rule."""
        try:
            if session_id:
                with self.session_lock:
                    temp_current = self.current_session
                    self.current_session = session_id
                    session = self.sessions.get(session_id)
            else:
                session = self._get_current_session()
                temp_current = None

            if not session:
                return False

            try:
                response = requests.delete(
                    f"{self.base_url}/rules/{rule_id}",
                    headers=self.get_headers()
                )
                response.raise_for_status()
                with self.session_lock:
                    if rule_id in session.created_rules:
                        session.created_rules.remove(rule_id)
                print(f"{Fore.GREEN}Deleted rule: {rule_id}")
                return True
            finally:
                if session_id and temp_current:
                    with self.session_lock:
                        self.current_session = temp_current
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

    def revert_rule(self, rule_id: str, target_version: int) -> bool:
        """Revert a rule to a specific version."""
        try:
            response = requests.put(
                f"{self.base_url}/rules/{rule_id}/revert",
                json={"targetVersion": target_version},
                headers=self.get_headers()
            )
            response.raise_for_status()
            result = response.json()
            print(f"{Fore.GREEN}Reverted rule {rule_id} to version {target_version}")
            print(f"{Fore.YELLOW}Response: {json.dumps(result, indent=2)}")
            return True
        except requests.exceptions.RequestException as e:
            print(f"{Fore.RED}Error reverting rule: {str(e)}")
            if hasattr(e.response, 'text'):
                print(f"{Fore.RED}Response: {e.response.text}")
            return False

    def get_rule_versions(self, rule_id: str) -> Optional[List[dict]]:
        """Get version history for a specific rule."""
        try:
            response = requests.get(
                f"{self.base_url}/rules/{rule_id}/versions",
                headers=self.get_headers()
            )
            response.raise_for_status()
            versions = response.json().get('versions', [])
            print(f"{Fore.GREEN}Retrieved {len(versions)} versions for rule {rule_id}")
            return versions
        except requests.exceptions.RequestException as e:
            print(f"{Fore.RED}Error getting rule versions: {str(e)}")
            if hasattr(e.response, 'text'):
                print(f"{Fore.RED}Response: {e.response.text}")
            return None

    def get_specific_rule(self, rule_id: str) -> Optional[dict]:
        """Get a specific rule by ID."""
        try:
            response = requests.get(
                f"{self.base_url}/rules/{rule_id}",
                headers=self.get_headers()
            )
            response.raise_for_status()
            rule = response.json()
            print(f"{Fore.GREEN}Retrieved rule: {rule_id}")
            return rule
        except requests.exceptions.RequestException as e:
            print(f"{Fore.RED}Error getting rule: {str(e)}")
            if hasattr(e.response, 'text'):
                print(f"{Fore.RED}Response: {e.response.text}")
            return None

    def cleanup_session(self, session_id: Optional[str] = None) -> None:
        """Clean up rules created in a session with thread safety."""
        with self.session_lock:
            if session_id:
                session = self.sessions.get(session_id)
            else:
                session = self._get_current_session()

            if not session:
                return

            current_rules = session.created_rules.copy()
            print(f"{Fore.YELLOW}Cleaning up session: {session.id}")

        # Delete each rule with explicit session context
        for rule_id in current_rules:
            self.delete_rule(rule_id, session.id)

        with self.session_lock:
            if session_id and session_id in self.sessions:
                del self.sessions[session_id]
                if self.current_session == session_id:
                    self.current_session = None
                print(f"{Fore.GREEN}Session {session_id} cleaned up and removed")

    def cleanup_all_sessions(self) -> None:
        """Clean up all testing sessions with thread safety."""
        print(f"{Fore.YELLOW}Cleaning up all sessions")
        with self.session_lock:
            session_ids = list(self.sessions.keys())

        for session_id in session_ids:
            self.cleanup_session(session_id)

        print(f"{Fore.GREEN}All sessions cleaned up")

    def get_session_info(self, session_id: Optional[str] = None) -> None:
        """Display information about a specific session or the current session."""
        with self.session_lock:
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

def run_session_loop(
    simulator: RateLimiterApiSimulator,
    duration: int,
    interval: tuple[int, int]
) -> None:
    """Run a single session loop with operations."""
    session_id = None
    try:
        session_id = simulator.create_session()
        simulator.switch_session(session_id)

        # Create a rule
        rule_data = random.choice([create_test_rule_1, create_test_rule_2])()
        rule_id = simulator.create_rule(rule_data)

        if rule_id:
            # Get specific rule
            rule = simulator.get_specific_rule(rule_id)

            # Wait a bit before updating
            time.sleep(random.uniform(*interval))

            # Update the rule
            update_data = create_test_rule_update(rule_id, rule_data["order"])
            simulator.update_rule(rule_id, update_data)

            # Get version history
            versions = simulator.get_rule_versions(rule_id)
            if versions and len(versions) > 0:
                # Try reverting to first version
                simulator.revert_rule(rule_id, versions[0]['version'])

            # Get current rules and attempt reordering
            current_rules = simulator.get_rules()
            if current_rules:
                rule_ids = [r['id'] for r in current_rules]
                if rule_id in rule_ids:
                    # Move our rule to a random position
                    rule_ids.remove(rule_id)
                    insert_pos = random.randint(0, len(rule_ids))
                    rule_ids.insert(insert_pos, rule_id)
                    simulator.reorder_rules(rule_ids)

        # Wait before session cleanup
        time.sleep(random.uniform(*interval))

    except Exception as e:
        session_desc = f"session {session_id}" if session_id else "unknown session"
        print(f"{Fore.RED}Error in {session_desc}: {str(e)}")
    finally:
        if session_id:
            simulator.cleanup_session(session_id)

def run_rotating_load_test(
    base_url: str,
    num_sessions: int = 3,
    duration: int = 60,
    interval: tuple[int, int] = (1, 5),
    rotation_interval: int = 10
) -> None:
    """Run a load test with rotating sessions."""
    print(f"{Fore.CYAN}Starting rotating load test:")
    print(f"Concurrent sessions: {num_sessions}")
    print(f"Duration: {duration} seconds")
    print(f"Operation interval: {interval[0]}-{interval[1]} seconds")
    print(f"Session rotation interval: {rotation_interval} seconds")

    simulator = RateLimiterApiSimulator(base_url)
    start_time = time.time()
    rotation_count = 0

    def handle_interrupt(signum, frame):
        print(f"\n{Fore.YELLOW}Interrupt received. Cleaning up...")
        simulator.cleanup_all_sessions()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_interrupt)

    try:
        while time.time() - start_time < duration:
            rotation_count += 1
            print(f"\n{Fore.CYAN}Starting rotation {rotation_count}")
            print(f"Time elapsed: {int(time.time() - start_time)} seconds")

            with ThreadPoolExecutor(max_workers=num_sessions) as executor:
                futures = [
                    executor.submit(run_session_loop, simulator, duration, interval)
                    for _ in range(num_sessions)
                ]

                # Wait for the rotation interval or remaining duration
                remaining_time = duration - (time.time() - start_time)
                wait_time = min(rotation_interval, remaining_time)

                if wait_time <= 0:
                    break

                # Wait for the current batch of sessions to complete or timeout
                try:
                    for future in futures:
                        future.result(timeout=wait_time)
                except TimeoutError:
                    print(f"{Fore.YELLOW}Session rotation timeout - starting new rotation")

            # Print current statistics
            current_rules = simulator.get_rules()
            if current_rules:
                print(f"\n{Fore.CYAN}Current rule count: {len(current_rules)}")

    finally:
        print(f"\n{Fore.YELLOW}Test complete. Cleaning up...")
        simulator.cleanup_all_sessions()

        end_time = time.time()
        print(f"\n{Fore.CYAN}Test Summary:")
        print(f"Total time: {int(end_time - start_time)} seconds")
        print(f"Total rotations: {rotation_count}")

def main():
    parser = argparse.ArgumentParser(description="Rate Limiter API Simulator")
    parser.add_argument("--url", required=True, help="Base URL of the Rate Limiter API")
    parser.add_argument("--sessions", type=int, default=3, help="Number of concurrent sessions")
    parser.add_argument("--duration", type=int, default=60, help="Test duration in seconds")
    parser.add_argument("--min-interval", type=float, default=1, help="Minimum seconds between operations")
    parser.add_argument("--max-interval", type=float, default=5, help="Maximum seconds between operations")
    parser.add_argument("--rotation-interval", type=int, default=10, help="Session rotation interval in seconds")
    parser.add_argument("--mode", choices=["single", "rotating"], default="single", help="Test mode")
    args = parser.parse_args()

    if args.mode == "rotating":
        run_rotating_load_test(
            args.url,
            num_sessions=args.sessions,
            duration=args.duration,
            interval=(args.min_interval, args.max_interval),
            rotation_interval=args.rotation_interval
        )
    else:
        # Original single-run test
        simulator = RateLimiterApiSimulator(args.url)

        print(f"{Fore.CYAN}Rate Limiter API Simulator")
        print(f"Base URL: {args.url}\n")

        # Create test sessions
        session1 = simulator.create_session()
        session2 = simulator.create_session()

        # Get current rules
        print("\nFetching current rules...")
        current_rules = simulator.get_rules()
        if current_rules:
            print(f"\n{Fore.CYAN}Current Rules:")
            print(json.dumps(current_rules, indent=2))

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

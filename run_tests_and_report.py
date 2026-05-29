#!/usr/bin/env python
import subprocess
import json
import csv
import re
import os
import xml.etree.ElementTree as ET
from datetime import datetime

# Files to generate
REPORT_JSON = "test_report.json"
REPORT_CSV = "test_report.csv"
INTEGRATION_XML = "tests_integration_report.xml"

# Helper to strip ANSI escape codes (colors)
ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

def clean_ansi(text):
    return ANSI_ESCAPE.sub('', text)

def map_integration_test(classname, name):
    """Maps a pytest integration test case to its target microservice, endpoint, and category."""
    microservice = "gateway"
    endpoint = "N/A"
    category = "Integration"
    
    if "TestHealthChecks" in classname:
        category = "Health Check"
        if "usuarios" in name:
            microservice = "ms_usuarios"
            endpoint = "/api/usuarios/health"
        elif "candidatos" in name:
            microservice = "ms_candidatos"
            endpoint = "/api/candidatos/health"
        elif "votacion" in name:
            microservice = "ms_votacion"
            endpoint = "/api/votacion/health"
        elif "biometrico" in name:
            microservice = "ms_biometrico"
            endpoint = "/api/biometrico/health"
            
    elif "TestUserRegistrationFlow" in classname:
        microservice = "ms_usuarios"
        endpoint = "/api/usuarios/"
        category = "CRUD / Registration"
        
    elif "TestAuthenticationFlow" in classname:
        microservice = "ms_usuarios"
        endpoint = "/api/usuarios/auth/login"
        category = "Authentication"
        if "protected_route" in name:
            endpoint = "/api/votacion/"
            
    elif "TestCandidateFlow" in classname:
        microservice = "ms_candidatos"
        endpoint = "/api/candidatos/"
        category = "CRUD / Candidate Management"
        if "nonexistent" in name:
            endpoint = "/api/candidatos/<id>"
            
    elif "TestVotingFlow" in classname:
        microservice = "ms_votacion"
        endpoint = "/api/votacion/"
        category = "Voting Flow"
        
    elif "TestSecurityFlow" in classname:
        category = "Security"
        if "xss" in name:
            microservice = "ms_usuarios"
            endpoint = "/api/usuarios/"
        elif "fake_image" in name:
            microservice = "ms_biometrico"
            endpoint = "/api/biometrico/register/face"
            
    return microservice, endpoint, category

def run_integration_tests():
    print(">>> Running Integration Tests...")
    results = []
    
    python_path = os.path.join(".venv", "Scripts", "python")
    if not os.path.exists(python_path):
        python_path = "python"
        
    cmd = [python_path, "-m", "pytest", "tests/integration/", f"--junitxml={INTEGRATION_XML}", "-q"]
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    subprocess.run(cmd, capture_output=True, text=True, env=env)
    
    if os.path.exists(INTEGRATION_XML):
        try:
            tree = ET.parse(INTEGRATION_XML)
            root = tree.getroot()
            
            for testsuite in root.findall('testsuite'):
                for testcase in testsuite.findall('testcase'):
                    name = testcase.get('name', 'unknown')
                    classname = testcase.get('classname', 'unknown').split('.')[-1]
                    
                    raw_time = testcase.get('time')
                    latency_ms = round(float(raw_time) * 1000, 2) if raw_time else 0.0
                    
                    failure = testcase.find('failure')
                    error = testcase.find('error')
                    skipped = testcase.find('skipped')
                    
                    if failure is not None:
                        status = "FAILED"
                        details = failure.text.strip().split('\n')[0] if failure.text else "Failed"
                    elif error is not None:
                        status = "FAILED"
                        details = error.text.strip().split('\n')[0] if error.text else "Error"
                    elif skipped is not None:
                        status = "SKIPPED"
                        details = skipped.get('message', 'Skipped')
                    else:
                        status = "PASSED"
                        details = "Test passed successfully"
                        
                    microservice, endpoint, category = map_integration_test(classname, name)
                    
                    results.append({
                        "name": f"{classname}.{name}",
                        "microservice": microservice,
                        "endpoint": endpoint,
                        "category": category,
                        "status": status,
                        "latency_ms": latency_ms,
                        "payload_size_kb": "N/A",
                        "details": details
                    })
            
            os.remove(INTEGRATION_XML)
        except Exception as e:
            results.append({
                "name": "Integration Tests Parsing",
                "microservice": "gateway",
                "endpoint": "N/A",
                "category": "Setup",
                "status": "FAILED",
                "latency_ms": 0.0,
                "payload_size_kb": "N/A",
                "details": f"Error parsing integration XML: {str(e)}"
            })
    else:
        results.append({
            "name": "Integration Tests Run",
            "microservice": "gateway",
            "endpoint": "N/A",
            "category": "Setup",
            "status": "FAILED",
            "latency_ms": 0.0,
            "payload_size_kb": "N/A",
            "details": "Integration tests failed to run or did not generate XML."
        })
        
    return results

def run_script_test(script_path, suite_name):
    print(f">>> Running {suite_name} Tests ({script_path})...")
    results = []
    
    python_path = os.path.join(".venv", "Scripts", "python")
    if not os.path.exists(python_path):
        python_path = "python"
        
    cmd = [python_path, script_path]
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore", env=env)
    
    clean_stdout = clean_ansi(res.stdout)
    
    current_test_topic = f"{suite_name} Setup/Check"
    
    lines = clean_stdout.split("\n")
    test_case_idx = 1
    
    temp_metrics = {"latency_ms": 0.0, "payload_size_kb": "N/A"}
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        topic_match = re.search(r'\[(?:Test\s+)?(\d+)\]\s*(.+)', line)
        if topic_match:
            current_test_topic = f"Test {topic_match.group(1)}: {topic_match.group(2).strip(':.')}"
            temp_metrics = {"latency_ms": 0.0, "payload_size_kb": "N/A"}
            continue
            
        latency_match = re.search(r'(?:Tiempo de ejecucion|Time elapsed):\s*([\d.]+)\s*ms', line, re.IGNORECASE)
        if latency_match:
            temp_metrics["latency_ms"] = float(latency_match.group(1))
            
        payload_match = re.search(r'(?:Tamano del Payload|Payload size):\s*([\d.]+)\s*KB', line, re.IGNORECASE)
        if payload_match:
            temp_metrics["payload_size_kb"] = float(payload_match.group(1))
            
        if "[EXITO]" in line or "[ÉXITO]" in line:
            msg = line.replace("[EXITO]", "").replace("[ÉXITO]", "").strip()
            microservice, endpoint, category = map_script_test_metadata(suite_name, current_test_topic)
            results.append({
                "name": f"{current_test_topic} (Verification {test_case_idx})",
                "microservice": microservice,
                "endpoint": endpoint,
                "category": category,
                "status": "PASSED",
                "latency_ms": temp_metrics["latency_ms"],
                "payload_size_kb": temp_metrics["payload_size_kb"],
                "details": msg
            })
            test_case_idx += 1
        elif "[FALLO]" in line or "[FALLO CRITICO]" in line:
            msg = line.replace("[FALLO CRITICO]", "").replace("[FALLO]", "").strip()
            microservice, endpoint, category = map_script_test_metadata(suite_name, current_test_topic)
            results.append({
                "name": f"{current_test_topic} (Verification {test_case_idx})",
                "microservice": microservice,
                "endpoint": endpoint,
                "category": category,
                "status": "FAILED",
                "latency_ms": temp_metrics["latency_ms"],
                "payload_size_kb": temp_metrics["payload_size_kb"],
                "details": msg
            })
            test_case_idx += 1
        elif "[ADVERTENCIA]" in line:
            msg = line.replace("[ADVERTENCIA]", "").strip()
            microservice, endpoint, category = map_script_test_metadata(suite_name, current_test_topic)
            results.append({
                "name": f"{current_test_topic} (Verification {test_case_idx})",
                "microservice": microservice,
                "endpoint": endpoint,
                "category": category,
                "status": "WARNING",
                "latency_ms": temp_metrics["latency_ms"],
                "payload_size_kb": temp_metrics["payload_size_kb"],
                "details": msg
            })
            test_case_idx += 1
            
    if not results:
        microservice, endpoint, category = map_script_test_metadata(suite_name, current_test_topic)
        if res.returncode == 0:
            results.append({
                "name": f"{suite_name} Script",
                "microservice": microservice,
                "endpoint": endpoint,
                "category": category,
                "status": "PASSED",
                "latency_ms": 0.0,
                "payload_size_kb": "N/A",
                "details": "Script executed successfully with exit code 0"
            })
        else:
            results.append({
                "name": f"{suite_name} Script",
                "microservice": microservice,
                "endpoint": endpoint,
                "category": category,
                "status": "FAILED",
                "latency_ms": 0.0,
                "payload_size_kb": "N/A",
                "details": f"Script failed with exit code {res.returncode}. Error: {res.stderr.strip()}"
            })
            
    return results

def map_script_test_metadata(suite_name, topic):
    """Maps custom scripts topics to detailed metadata for the dashboard."""
    microservice = "gateway"
    endpoint = "N/A"
    category = "System"
    
    if suite_name == "Security":
        category = "Security PenTest"
        if "Rate Limiting" in topic:
            microservice = "ms_usuarios"
            endpoint = "/api/usuarios/auth/login"
            category = "Security / Rate Limiting"
        elif "SQL Injection" in topic:
            microservice = "ms_usuarios"
            endpoint = "/api/usuarios/by-dni/<dni>"
            category = "Security / SQL Injection"
        elif "JWT Manipulation" in topic:
            microservice = "ms_usuarios"
            endpoint = "/api/usuarios/auth/me"
            category = "Security / JWT Validation"
        elif "XSS" in topic:
            microservice = "ms_usuarios"
            endpoint = "/api/usuarios/"
            category = "Security / XSS Protection"
            
    elif suite_name == "Recovery":
        category = "Chaos / Resilience"
        topic_lower = topic.lower()
        if any(x in topic_lower for x in ["bd", "galera", "mysql", "pxc", "database"]):
            microservice = "db"
            endpoint = "/api/usuarios/by-email/admin@test.local"
            category = "Resilience / Database Down"
        elif "usuarios" in topic_lower or "ms-usuarios" in topic_lower:
            microservice = "ms_usuarios"
            endpoint = "/api/usuarios/health"
            category = "Resilience / Microservice Down"
        elif "biometrico" in topic_lower or "ms-biometrico" in topic_lower:
            microservice = "ms_biometrico"
            endpoint = "/api/biometrico/health"
            category = "Resilience / Microservice Down"
        elif "votacion" in topic_lower or "ms-votacion" in topic_lower:
            microservice = "ms_votacion"
            endpoint = "/api/votacion/health"
            category = "Resilience / Microservice Down"
        elif "candidatos" in topic_lower or "ms-candidatos" in topic_lower:
            microservice = "ms_candidatos"
            endpoint = "/api/candidatos/health"
            category = "Resilience / Microservice Down"
        elif "analisis" in topic_lower or "ms-analisis" in topic_lower:
            microservice = "ms_analisis"
            endpoint = "/api/analisis/health"
            category = "Resilience / Microservice Down"
            
    elif suite_name == "Performance":
        category = "Performance Profiling"
        if "candidatos" in topic:
            microservice = "ms_candidatos"
            endpoint = "/api/candidatos/"
        elif "votacion" in topic:
            microservice = "ms_votacion"
            endpoint = "/api/votacion/user/<id>"
            
    return microservice, endpoint, category

def parse_playwright_suites(suites, results_list):
    """Recursively processes Playwright JSON report suites to extract tests details."""
    for suite in suites:
        file_path = suite.get("file", "N/A")
        
        # specs inside this suite
        for spec in suite.get("specs", []):
            title = spec.get("title", "unknown")
            
            # Traverse tests
            for test in spec.get("tests", []):
                # Expected vs unexpected status
                ok = spec.get("ok", True)
                status = "PASSED" if ok else "FAILED"
                duration_ms = 0.0
                details = "Test passed successfully"
                
                results = test.get("results", [])
                if results:
                    res = results[0]
                    duration_ms = float(res.get("duration", 0.0))
                    res_status = res.get("status")
                    if res_status == "passed":
                        status = "PASSED"
                    elif res_status in ["failed", "timedOut"]:
                        status = "FAILED"
                        errors = res.get("errors", [])
                        if errors:
                            details = clean_ansi(errors[0].get("message", "Test failed")).split("\n")[0]
                        else:
                            details = "Test failed"
                    elif res_status == "skipped":
                        status = "SKIPPED"
                        details = "Test skipped"
                
                # Classify category dynamically
                category = "Frontend Regression"
                if "auth" in file_path or "auth" in title.lower():
                    category = "Authentication UI"
                elif "register" in file_path or "register" in title.lower():
                    category = "Registration UI"
                elif "smoke" in file_path or "smoke" in title.lower():
                    category = "Smoke UI Test"
                elif "vote" in file_path or "vote" in title.lower():
                    category = "Voting UI Flow"
                elif "biometrics" in file_path or "biometric" in title.lower():
                    category = "Biometric UI Mock"
                    
                results_list.append({
                    "name": f"Playwright: {title}",
                    "microservice": "frontend",
                    "endpoint": "UI / Client",
                    "category": category,
                    "status": status,
                    "latency_ms": duration_ms,
                    "payload_size_kb": "N/A",
                    "details": details
                })
        
        # Process sub-suites
        if "suites" in suite:
            parse_playwright_suites(suite["suites"], results_list)

def run_playwright_tests():
    print(">>> Running Playwright Frontend Tests (npx playwright test)...")
    results = []
    
    cmd = "npx playwright test --project=chromium --reporter=json"
    res = subprocess.run(cmd, cwd="frontend", shell=True, capture_output=True, text=True)
    
    stdout_content = res.stdout
    
    if stdout_content:
        try:
            # Find the JSON boundaries
            start_idx = stdout_content.find('{')
            end_idx = stdout_content.rfind('}')
            if start_idx != -1 and end_idx != -1:
                json_str = stdout_content[start_idx:end_idx+1]
                report_data = json.loads(json_str)
                
                suites = report_data.get("suites", [])
                parse_playwright_suites(suites, results)
            else:
                results.append({
                    "name": "Playwright Tests Run",
                    "microservice": "frontend",
                    "endpoint": "UI / Client",
                    "category": "Setup",
                    "status": "FAILED",
                    "latency_ms": 0.0,
                    "payload_size_kb": "N/A",
                    "details": f"Could not find JSON block in stdout. Raw output: {stdout_content[:200]}"
                })
        except Exception as e:
            results.append({
                "name": "Playwright Tests Parsing",
                "microservice": "frontend",
                "endpoint": "UI / Client",
                "category": "Setup",
                "status": "FAILED",
                "latency_ms": 0.0,
                "payload_size_kb": "N/A",
                "details": f"Error parsing Playwright JSON: {str(e)}. Raw output: {stdout_content[:200]}"
            })
    else:
        results.append({
            "name": "Playwright Tests Run",
            "microservice": "frontend",
            "endpoint": "UI / Client",
            "category": "Setup",
            "status": "FAILED",
            "latency_ms": 0.0,
            "payload_size_kb": "N/A",
            "details": f"Playwright returned empty stdout. Stderr: {res.stderr[:200]}"
        })
        
    return results

def main():
    timestamp = datetime.now().isoformat()
    print(f"=== VoteSystem Test Suite Orchestrator (Full Stack Rich Dashboard) ===")
    print(f"Timestamp: {timestamp}\n")
    
    all_results = {}
    
    # 1. Run Backend Integration Tests
    all_results["Integration"] = run_integration_tests()
    
    # 2. Run Playwright Frontend Tests
    all_results["Frontend"] = run_playwright_tests()
    
    # 3. Run Security Tests
    all_results["Security"] = run_script_test(os.path.join("tests", "security_tests.py"), "Security")
    
    # 4. Run Recovery/Chaos Tests (both DB and Microservices tests)
    recovery_db_results = run_script_test(os.path.join("tests", "recovery_tests.py"), "Recovery")
    recovery_ms_results = run_script_test(os.path.join("tests", "recovery_tests_ms.py"), "Recovery")
    all_results["Recovery"] = recovery_db_results + recovery_ms_results
    
    # 5. Run Performance Profiler
    all_results["Performance"] = run_script_test(os.path.join("tests", "performance_profiler.py"), "Performance")
    
    # Calculate Summary Metrics
    total_tests = 0
    passed_tests = 0
    failed_tests = 0
    warning_tests = 0
    skipped_tests = 0
    
    flat_results = []
    
    for suite, suite_res in all_results.items():
        for item in suite_res:
            total_tests += 1
            status = item["status"]
            if status == "PASSED":
                passed_tests += 1
            elif status == "FAILED":
                failed_tests += 1
            elif status == "WARNING":
                warning_tests += 1
            elif status == "SKIPPED":
                skipped_tests += 1
                
            flat_results.append({
                "Suite": suite,
                "Test Name": item["name"],
                "Microservice": item["microservice"],
                "Endpoint": item["endpoint"],
                "Category": item["category"],
                "Status": status,
                "Latency (ms)": item["latency_ms"],
                "Payload Size (KB)": item["payload_size_kb"],
                "Details": item["details"],
                "Timestamp": timestamp
            })
            
    summary = {
        "timestamp": timestamp,
        "metrics": {
            "total": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "warning": warning_tests,
            "skipped": skipped_tests,
            "success_rate_percent": round((passed_tests / total_tests * 100), 2) if total_tests > 0 else 0.0
        },
        "results": all_results
    }
    
    # Write JSON report
    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=4, ensure_ascii=False)
    print(f"\n>>> Full-Stack JSON report saved successfully to: {REPORT_JSON}")
    
    # Write CSV report
    csv_headers = [
        "Suite", "Test Name", "Microservice", "Endpoint", 
        "Category", "Status", "Latency (ms)", "Payload Size (KB)", 
        "Details", "Timestamp"
    ]
    with open(REPORT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_headers)
        writer.writeheader()
        writer.writerows(flat_results)
    print(f">>> Full-Stack CSV report saved successfully to: {REPORT_CSV}")
    
    print("\n==============================================")
    print(f"Summary: {passed_tests}/{total_tests} Passed, {failed_tests} Failed, {warning_tests} Warnings")
    print(f"Success Rate: {summary['metrics']['success_rate_percent']}%")
    print("==============================================")
    
    if failed_tests > 0:
        import sys
        sys.exit(1)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
High-Throughput C++ Risk Engine Load Generator & Benchmark Exporter
==================================================================
Runs synthetic high-frequency bet evaluation workloads through the C++ risk engine,
computes nanosecond/microsecond percentile latency distributions (p50, p90, p95, p99),
measures throughput (ops/sec) and memory footprint, and exports structured telemetry
to frontend/src/assets/benchmark-data.json for the Angular dashboard and Vercel preview.
"""

import argparse
import datetime
import json
import os
import subprocess
import sys
import time
from pathlib import Path

# Paths
REPO_ROOT = Path(__file__).resolve().parent.parent
BUILD_DIR = REPO_ROOT / "build"
RISK_ENGINE_BIN = BUILD_DIR / "risk_engine"
DEFAULT_OUTPUT_ASSET = REPO_ROOT / "frontend" / "src" / "assets" / "benchmark-data.json"


def ensure_cpp_binary_built(release_mode: bool = False) -> bool:
    """Builds the C++ risk engine binary if missing or if release build is requested."""
    BUILD_DIR.mkdir(exist_ok=True)
    
    cmake_args = ["cmake", "-B", str(BUILD_DIR), str(REPO_ROOT / "risk_engine")]
    if release_mode:
        cmake_args.extend(["-DCMAKE_BUILD_TYPE=Release", "-DRISK_ENGINE_ENABLE_ASAN=OFF"])
        
    print(f"[benchmark_runner] Configuring CMake in {BUILD_DIR}...")
    conf_res = subprocess.run(cmake_args, cwd=REPO_ROOT, capture_output=True, text=True)
    if conf_res.returncode != 0:
        print(f"[benchmark_runner] CMake config error: {conf_res.stderr}", file=sys.stderr)
        return False
        
    print("[benchmark_runner] Compiling risk_engine executable...")
    build_res = subprocess.run(["cmake", "--build", str(BUILD_DIR), "-j4"], cwd=REPO_ROOT, capture_output=True, text=True)
    if build_res.returncode != 0:
        print(f"[benchmark_runner] Build error: {build_res.stderr}", file=sys.stderr)
        return False
        
    return RISK_ENGINE_BIN.exists()


def run_cpp_benchmark(events: int, output_path: Path) -> dict:
    """Executes the C++ standalone benchmark harness and exports JSON metrics."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    cmd = [
        str(RISK_ENGINE_BIN),
        "--benchmark",
        "--events", str(events),
        "--output", str(output_path)
    ]
    
    print(f"\n[benchmark_runner] Launching C++ Benchmark Harness...")
    print(f"• Executable: {RISK_ENGINE_BIN}")
    print(f"• Event Count: {events:,}")
    print(f"• Target JSON: {output_path}\n")
    
    start_time = time.perf_counter()
    res = subprocess.run(cmd, cwd=REPO_ROOT, text=True, capture_output=True)
    wall_duration = time.perf_counter() - start_time
    
    print(res.stdout)
    if res.stderr:
        print(f"[risk_engine stderr] {res.stderr}", file=sys.stderr)
        
    if res.returncode != 0:
        raise RuntimeError(f"C++ risk engine benchmark exited with code {res.returncode}")
        
    if not output_path.exists():
        raise FileNotFoundError(f"Expected benchmark output file not found at {output_path}")
        
    with open(output_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    return data


def format_summary_table(data: dict) -> None:
    """Prints a styled terminal summary card."""
    print("=" * 68)
    print("BENCHMARK TELEMETRY EXPORT SUMMARY")
    print("=" * 68)
    print(f"  • Timestamp:               {data.get('timestamp')}")
    print(f"  • Total Events Processed:  {data.get('total_events_processed', 0):,}")
    print(f"  • Throughput:              {data.get('throughput_ops_sec', 0):,} ops/sec")
    print(f"  • p50 Median Latency:      {data.get('p50_latency_us', 0):.2f} µs")
    print(f"  • p90 Tail Latency:        {data.get('p90_latency_us', 0):.2f} µs")
    print(f"  • p95 High Latency:        {data.get('p95_latency_us', 0):.2f} µs")
    print(f"  • p99 Worst-Case Latency:  {data.get('p99_latency_us', 0):.2f} µs")
    print(f"  • Memory Footprint (RSS):  {data.get('memory_footprint_mb', 0):.2f} MB")
    print(f"  • Zero-Copy string_view:   {'ENABLED' if data.get('zero_copy_string_view') else 'DISABLED'}")
    print(f"  • Lock-Free CAS Atomics:   {'ENABLED' if data.get('lock_free_atomics') else 'DISABLED'}")
    print("=" * 68)


def main():
    parser = argparse.ArgumentParser(description="Run C++ risk engine load benchmark and export telemetry.")
    parser.add_argument("--events", "-n", type=int, default=50000, help="Number of synthetic bet events to evaluate (default: 50,000)")
    parser.add_argument("--output", "-o", type=str, default=str(DEFAULT_OUTPUT_ASSET), help="Target export JSON path")
    parser.add_argument("--release", action="store_true", help="Compile and run in optimized Release mode without ASan overhead")
    parser.add_argument("--rebuild", action="store_true", help="Force recompilation of the C++ risk engine executable")
    
    args = parser.parse_args()
    output_path = Path(args.output).resolve()
    
    if args.rebuild or not RISK_ENGINE_BIN.exists() or args.release:
        if not ensure_cpp_binary_built(release_mode=args.release):
            sys.exit(1)
            
    try:
        data = run_cpp_benchmark(events=args.events, output_path=output_path)
        format_summary_table(data)
        print(f"\n[SUCCESS] Successfully exported benchmark telemetry to:\n   {output_path}\n")
    except Exception as e:
        print(f"\n[ERROR] Benchmark execution failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

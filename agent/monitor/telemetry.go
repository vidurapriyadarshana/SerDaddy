package monitor

import (
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

// SystemStats holds the current host telemetry
type SystemStats struct {
	CPUPercent    float64 `json:"cpuPercent"`
	RAMUsedBytes  uint64  `json:"ramUsedBytes"`
	RAMTotalBytes uint64  `json:"ramTotalBytes"`
	DiskUsedBytes uint64  `json:"diskUsedBytes"`
	DiskTotalBytes uint64  `json:"diskTotalBytes"`
	UptimeSeconds uint64  `json:"uptimeSeconds"`
}

// GetSystemStats retrieves live statistics from the host OS
func GetSystemStats() (*SystemStats, error) {
	stats := &SystemStats{}

	// 1. CPU Usage
	cpuPercents, err := cpu.Percent(time.Second, false)
	if err == nil && len(cpuPercents) > 0 {
		stats.CPUPercent = cpuPercents[0]
	} else {
		stats.CPUPercent = 0.0
	}

	// 2. Memory Usage
	vMem, err := mem.VirtualMemory()
	if err == nil {
		stats.RAMUsedBytes = vMem.Used
		stats.RAMTotalBytes = vMem.Total
	}

	// 3. Disk Usage (Root partition)
	dUsage, err := disk.Usage("/")
	if err == nil {
		stats.DiskUsedBytes = dUsage.Used
		stats.DiskTotalBytes = dUsage.Total
	}

	// 4. Host Uptime
	hInfo, err := host.Info()
	if err == nil {
		stats.UptimeSeconds = hInfo.Uptime
	}

	return stats, nil
}

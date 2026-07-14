package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"serdaddy-agent/monitor"
	"serdaddy-agent/runner"
)

var (
	panelURL = flag.String("panel", "http://localhost:4000", "SerDaddy Hub API address (e.g., http://localhost:4000)")
	token    = flag.String("token", "MOCK_SERVER_TOKEN", "Registration Agent Token key")
	mockMode = flag.Bool("mock", false, "Enable mock mode to simulate Linux metrics (CPU/RAM/Disk)")
)

// SocketIOEvent represents a standard socket.io namespace message event structure.
type SocketIOEvent struct {
	Name    string
	Payload json.RawMessage
}

// UnmarshalJSON parses Socket.io event array format: [eventName, payload]
func (e *SocketIOEvent) UnmarshalJSON(data []byte) error {
	var raw []json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	if len(raw) < 1 {
		return fmt.Errorf("empty event array")
	}
	if err := json.Unmarshal(raw[0], &e.Name); err != nil {
		return err
	}
	if len(raw) > 1 {
		e.Payload = raw[1]
	}
	return nil
}

func main() {
	flag.Parse()

	log.Println("🚀 Starting SerDaddy Agent Daemon...")
	if *mockMode {
		log.Println("💡 Running in Mock Mode - OS-level commands and metrics will be simulated.")
	}

	// Format connection URL to replace http/https with ws/wss
	rawURL := *panelURL
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		rawURL = "http://" + rawURL
	}

	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		log.Fatalf("Invalid panel URL provided: %v", err)
	}

	scheme := "ws"
	if parsedURL.Scheme == "https" {
		scheme = "wss"
	}

	// Socket.io v4 WebSocket connection path (Namespace: /agent)
	socketURL := fmt.Sprintf("%s://%s/socket.io/?EIO=4&transport=websocket", scheme, parsedURL.Host)
	log.Printf("Connecting to SerDaddy Hub WebSocket at: %s", socketURL)

	// Channel to catch interrupts for clean exit
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt, syscall.SIGTERM)

	// Reconnection Loop
	for {
		err := runClient(socketURL, *token, *mockMode, interrupt)
		if err == nil {
			log.Println("Connection closed cleanly by server. Exiting.")
			break
		}
		log.Printf("🔌 Connection lost: %v. Reconnecting in 5 seconds...", err)
		time.Sleep(5 * time.Second)
	}
}

func runClient(socketURL string, agentToken string, mock bool, interrupt chan os.Signal) error {
	c, _, err := websocket.DefaultDialer.Dial(socketURL, nil)
	if err != nil {
		return fmt.Errorf("dial failed: %w", err)
	}
	defer c.Close()

	log.Println("✅ Raw WebSocket connection established. Handshaking Engine.io...")

	// Read loop channels
	done := make(chan struct{})
	errChan := make(chan error, 1)

	// Mutex to synchronize writes to the WebSocket connection (concurrency safety)
	var writeMutex sync.Mutex
	safeWrite := func(messageType int, data []byte) error {
		writeMutex.Lock()
		defer writeMutex.Unlock()
		return c.WriteMessage(messageType, data)
	}

	// Start reading standard WebSocket packets in the background
	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				errChan <- err
				return
			}
			
			msgStr := string(message)
			
			if strings.HasPrefix(msgStr, "0") {
				log.Println("🤖 Engine.io handshake opened. Joining namespace '/agent'...")
				err := safeWrite(websocket.TextMessage, []byte("40/agent,"))
				if err != nil {
					errChan <- err
					return
				}
			} else if strings.HasPrefix(msgStr, "2") {
				// Ping received, write Pong back immediately
				err := safeWrite(websocket.TextMessage, []byte("3"))
				if err != nil {
					errChan <- err
					return
				}
			} else if strings.HasPrefix(msgStr, "40/agent,") {
				log.Println("🛡️ Connected to Namespace '/agent'. Sending authentication token...")
				authPayload := fmt.Sprintf(`42/agent,["agent:auth",{"agentToken":"%s"}]`, agentToken)
				err := safeWrite(websocket.TextMessage, []byte(authPayload))
				if err != nil {
					errChan <- err
					return
				}
			} else if strings.HasPrefix(msgStr, "42/agent,") {
				// Socket.io Namespace Event Message
				eventData := []byte(msgStr[9:])
				log.Printf("📥 Message received from Hub: %s", string(eventData))
				
				var ev SocketIOEvent
				if err := json.Unmarshal(eventData, &ev); err != nil {
					log.Printf("Failed to unmarshal socket.io event: %v", err)
					continue
				}

				switch ev.Name {
				case "auth:success":
					log.Println("🎉 Authentication success! Agent is registered ONLINE.")
				case "deploy:start":
					log.Println("📦 deploy:start event received! Spawning build execution...")
					go runner.ExecuteDeployment(safeWrite, ev.Payload, mock)
				case "deploy:rollback":
					log.Println("🔄 deploy:rollback event received! Spawning rollback runner...")
					go runner.ExecuteRollback(safeWrite, ev.Payload, mock)
				case "deploy:delete":
					log.Println("🗑️ deploy:delete event received! Spawning cleanup runner...")
					go runner.ExecuteDeletion(safeWrite, ev.Payload, mock)
				default:
					log.Printf("Unhandled event: %s", ev.Name)
				}
			}
		}
	}()

	// Start Telemetry Ticker (Emits CPU/RAM every 10 seconds)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			return <-errChan
		case <-ticker.C:
			// Emit metrics package
			metricsJSON := generateMetrics(mock)
			metricsPayload := fmt.Sprintf(`42/agent,["metrics:push",%s]`, metricsJSON)
			err := safeWrite(websocket.TextMessage, []byte(metricsPayload))
			if err != nil {
				log.Printf("Failed to emit metrics: %v", err)
			}
		case sig := <-interrupt:
			log.Printf("Interrupt signal received (%v). Cleaning up and closing connection...", sig)
			// Send Engine.io disconnect packet (41/agent,)
			_ = safeWrite(websocket.TextMessage, []byte("41/agent,"))
			
			// Cleanly close connection by sending close frame and waiting for write to flush
			writeMutex.Lock()
			err := c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			writeMutex.Unlock()
			if err != nil {
				return err
			}
			select {
			case <-done:
			case <-time.After(time.Second):
			}
			return nil
		}
	}
}

// Generate metrics payload
func generateMetrics(mock bool) string {
	var cpuPercent float64
	var ramUsed, ramTotal, diskUsed, diskTotal uint64
	var uptime uint64

	if mock {
		// Mock calculations
		rand.Seed(time.Now().UnixNano())
		cpuPercent = rand.Float64()*30.0 + 5.0 // 5% to 35% CPU
		ramTotal = 2048 * 1024 * 1024          // 2GB RAM
		ramUsed = uint64(float64(ramTotal) * (0.35 + rand.Float64()*0.15)) // 35% to 50% RAM
		diskTotal = 40 * 1024 * 1024 * 1024    // 40GB Disk
		diskUsed = 12 * 1024 * 1024 * 1024     // 12GB Disk Used
		uptime = 86400                         // 24 hours
	} else {
		// Real system telemetry parsing using the monitor package
		stats, err := monitor.GetSystemStats()
		if err == nil {
			cpuPercent = stats.CPUPercent
			ramUsed = stats.RAMUsedBytes
			ramTotal = stats.RAMTotalBytes
			diskUsed = stats.DiskUsedBytes
			diskTotal = stats.DiskTotalBytes
			uptime = stats.UptimeSeconds
		} else {
			// Fallback mock if parsing error occurs
			cpuPercent = 5.0
			ramTotal = 1024 * 1024 * 1024
			ramUsed = 256 * 1024 * 1024
			diskTotal = 10 * 1024 * 1024 * 1024
			diskUsed = 3 * 1024 * 1024 * 1024
			uptime = 60
		}
	}

	return fmt.Sprintf(`{"cpuPercent":%.2f,"ramUsedBytes":%d,"ramTotalBytes":%d,"diskUsedBytes":%d,"diskTotalBytes":%d,"uptimeSeconds":%d}`,
		cpuPercent, ramUsed, ramTotal, diskUsed, diskTotal, uptime)
}

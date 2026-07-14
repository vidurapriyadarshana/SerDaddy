package runner

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

// SafeWriteFunc represents a thread-safe websocket write wrapper.
type SafeWriteFunc func(messageType int, data []byte) error

type DeployStartPayload struct {
	DeploymentID string            `json:"deploymentId"`
	RepoURL      string            `json:"repoUrl"`
	Branch       string            `json:"branch"`
	AssignedPort int               `json:"assignedPort"`
	Subdomain    string            `json:"subdomain"`
	Env          map[string]string `json:"env"`
}

type DeployRollbackPayload struct {
	ProjectName       string `json:"projectName"`
	AssignedPort      int    `json:"assignedPort"`
	TargetReleasePath string `json:"targetReleasePath"`
}

type DeployLogEvent struct {
	DeploymentID string `json:"deploymentId"`
	Stream       string `json:"stream"`
	Chunk        string `json:"chunk"`
}

type DeployStatusEvent struct {
	DeploymentID string `json:"deploymentId"`
	Status       string `json:"status"`
	CommitHash   string `json:"commitHash,omitempty"`
	ReleasePath  string `json:"releasePath,omitempty"`
}

func getProjectName(repoURL string) string {
	parts := strings.Split(repoURL, "/")
	if len(parts) == 0 {
		return "unknown-app"
	}
	lastPart := parts[len(parts)-1]
	return strings.TrimSuffix(lastPart, ".git")
}

func streamLog(safeWrite SafeWriteFunc, deploymentID string, chunk string) {
	log.Printf("[BuildLog] %s", strings.TrimSpace(chunk))
	eventPayload := DeployLogEvent{
		DeploymentID: deploymentID,
		Stream:       "stdout",
		Chunk:        chunk,
	}
	payloadBytes, err := json.Marshal(eventPayload)
	if err != nil {
		return
	}
	payload := fmt.Sprintf(`42/agent,["deploy:log",%s]`, string(payloadBytes))
	_ = safeWrite(websocket.TextMessage, []byte(payload))
}

func sendStatus(safeWrite SafeWriteFunc, deploymentID string, status string, commitHash string, releasePath string) {
	log.Printf("[BuildStatus] Deployment %s ended with %s", deploymentID, status)
	eventPayload := DeployStatusEvent{
		DeploymentID: deploymentID,
		Status:       status,
		CommitHash:   commitHash,
		ReleasePath:  releasePath,
	}
	payloadBytes, err := json.Marshal(eventPayload)
	if err != nil {
		return
	}
	payload := fmt.Sprintf(`42/agent,["deploy:status",%s]`, string(payloadBytes))
	_ = safeWrite(websocket.TextMessage, []byte(payload))
}

// ExecuteDeployment handles end-to-end git checking, building, and deploying.
func ExecuteDeployment(safeWrite SafeWriteFunc, payloadRaw json.RawMessage, mock bool) {
	var payload DeployStartPayload
	if err := json.Unmarshal(payloadRaw, &payload); err != nil {
		log.Printf("Failed to unmarshal deploy:start payload: %v", err)
		return
	}

	projectName := getProjectName(payload.RepoURL)
	commitHash := fmt.Sprintf("release-%d", time.Now().Unix()) // fallback commit hash representation

	if mock {
		runMockDeployment(safeWrite, payload, projectName, commitHash)
		return
	}

	runRealDeployment(safeWrite, payload, projectName, commitHash)
}

// ExecuteRollback handles rolling back a project to a previously successful release.
func ExecuteRollback(safeWrite SafeWriteFunc, payloadRaw json.RawMessage, mock bool) {
	var payload DeployRollbackPayload
	if err := json.Unmarshal(payloadRaw, &payload); err != nil {
		log.Printf("Failed to unmarshal deploy:rollback payload: %v", err)
		return
	}

	log.Printf("🔄 Rolling back project %s to path %s", payload.ProjectName, payload.TargetReleasePath)

	// Promote symlink
	_, err := SwapReleaseSymlink(payload.ProjectName, filepath.Base(payload.TargetReleasePath), mock)
	if err != nil {
		log.Printf("Rollback failed during symlink swap: %v", err)
		return
	}

	// Restart service
	err = RestartProjectService(payload.ProjectName, mock)
	if err != nil {
		log.Printf("Rollback failed during service restart: %v", err)
		return
	}

	log.Printf("🎉 Rollback for %s succeeded.", payload.ProjectName)
}

func runMockDeployment(safeWrite SafeWriteFunc, payload DeployStartPayload, projectName string, commitHash string) {
	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Phase 1/4: Pre-deployment checks...\n")
	time.Sleep(600 * time.Millisecond)
	streamLog(safeWrite, payload.DeploymentID, fmt.Sprintf("[SerDaddy] Validating port %d bind. Port is free.\n", payload.AssignedPort))
	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Checking disk capacity... Server space threshold is ok (48%% capacity remaining).\n")

	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Phase 2/4: Code Retrieval...\n")
	time.Sleep(800 * time.Millisecond)
	streamLog(safeWrite, payload.DeploymentID, fmt.Sprintf("[SerDaddy] git clone --depth=1 --branch=%s %s /var/www/projects/%s/releases/%s\n", payload.Branch, payload.RepoURL, projectName, commitHash))
	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Clone completed successfully. Commit hash registered.\n")

	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Phase 3/4: Framework Detection & Build...\n")
	time.Sleep(500 * time.Millisecond)
	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] package.json detected in code root. Node.js project identified.\n")
	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Next.js framework identified.\n")
	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Running npm dependency installations...\n")
	time.Sleep(1000 * time.Millisecond)
	streamLog(safeWrite, payload.DeploymentID, "[yarn/npm] npm ci\n")
	streamLog(safeWrite, payload.DeploymentID, "[yarn/npm] added 813 packages in 4.234s\n")
	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Injected environment configurations into symlink .env file.\n")
	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Starting production compilation...\n")
	time.Sleep(1000 * time.Millisecond)
	streamLog(safeWrite, payload.DeploymentID, "[yarn/npm] npm run build\n")
	streamLog(safeWrite, payload.DeploymentID, "[yarn/npm] > next build\n")
	streamLog(safeWrite, payload.DeploymentID, "[yarn/npm] Creating an optimized production build...\n")
	streamLog(safeWrite, payload.DeploymentID, "[yarn/npm] ✓ Compiled successfully\n")

	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Phase 4/4: Configuration & Promoting Release...\n")
	time.Sleep(500 * time.Millisecond)

	// Mock writing systemd/nginx & symlinks
	subdomain := payload.Subdomain
	if subdomain == "" {
		subdomain = projectName + ".local"
	}

	_ = WriteSystemdService(projectName, payload.AssignedPort, true)
	_ = WriteNginxConfig(projectName, subdomain, payload.AssignedPort, false, true)
	releasePath, _ := SwapReleaseSymlink(projectName, commitHash, true)
	_ = RestartProjectService(projectName, true)

	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Systemd app service loaded & enabled.\n")
	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Nginx reverse proxy sites-enabled mapping updated and reloaded.\n")
	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Swapped symbolic link pointer /current -> release active folder.\n")
	
	// Provision Let's Encrypt SSL
	_ = ProvisionSSL(subdomain, "admin@serdaddy.com", true)
	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Let's Encrypt SSL certificate registered.\n")

	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Build completed successfully! Status set to SUCCESS.\n")

	sendStatus(safeWrite, payload.DeploymentID, "SUCCESS", commitHash, releasePath)
}

func runRealDeployment(safeWrite SafeWriteFunc, payload DeployStartPayload, projectName string, commitHash string) {
	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Phase 1/4: Pre-deployment checks...\n")

	// Check port availability
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", payload.AssignedPort))
	if err != nil {
		msg := fmt.Sprintf("[SerDaddy] ERROR: Port %d is already bound by another process. Aborting.\n", payload.AssignedPort)
		streamLog(safeWrite, payload.DeploymentID, msg)
		sendStatus(safeWrite, payload.DeploymentID, "FAILED", "", "")
		return
	}
	listener.Close()

	// Verify Nginx is installed
	_, err = exec.LookPath("nginx")
	if err != nil {
		streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] ERROR: Nginx is not installed or not in PATH. Aborting.\n")
		sendStatus(safeWrite, payload.DeploymentID, "FAILED", "", "")
		return
	}

	projectDir := fmt.Sprintf("/var/www/projects/%s", projectName)
	releasesDir := filepath.Join(projectDir, "releases")
	currentReleaseDir := filepath.Join(releasesDir, commitHash)

	// Create directories
	os.MkdirAll(releasesDir, 0755)

	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Phase 2/4: Code Retrieval...\n")
	// Clone repository
	cloneCmd := exec.Command("git", "clone", "--depth=1", "--branch="+payload.Branch, payload.RepoURL, currentReleaseDir)
	cloneOut, err := cloneCmd.CombinedOutput()
	if err != nil {
		msg := fmt.Sprintf("[SerDaddy] ERROR: Git clone failed: %s. Output: %s\n", err.Error(), string(cloneOut))
		streamLog(safeWrite, payload.DeploymentID, msg)
		sendStatus(safeWrite, payload.DeploymentID, "FAILED", "", "")
		return
	}
	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Repository cloned successfully.\n")

	// Get latest commit hash
	gitLog := exec.Command("git", "-C", currentReleaseDir, "rev-parse", "HEAD")
	hashBytes, _ := gitLog.Output()
	actualHash := strings.TrimSpace(string(hashBytes))
	if actualHash != "" {
		commitHash = actualHash
		// Rename directory to match actual commit hash
		newReleaseDir := filepath.Join(releasesDir, commitHash)
		if newReleaseDir != currentReleaseDir {
			os.RemoveAll(newReleaseDir)
			os.Rename(currentReleaseDir, newReleaseDir)
			currentReleaseDir = newReleaseDir
		}
	}

	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Phase 3/4: Framework Detection & Build...\n")
	// Setup env variables file
	envProdPath := filepath.Join(projectDir, ".env.production")
	var envContent strings.Builder
	for k, v := range payload.Env {
		envContent.WriteString(fmt.Sprintf("%s=\"%s\"\n", k, v))
	}
	_ = os.WriteFile(envProdPath, []byte(envContent.String()), 0600)

	// Symlink env file in release folder
	envReleasePath := filepath.Join(currentReleaseDir, ".env")
	os.Symlink(envProdPath, envReleasePath)

	// Scan frameworks
	isStatic := true
	var buildCmd *exec.Cmd
	if _, err := os.Stat(filepath.Join(currentReleaseDir, "package.json")); err == nil {
		isStatic = false
		streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] package.json detected. Running Node installer...\n")
		// Use npm ci and build
		installCmd := exec.Command("npm", "ci")
		installCmd.Dir = currentReleaseDir
		runCommandWithStreamingLogs(safeWrite, payload.DeploymentID, installCmd)

		buildCmd = exec.Command("npm", "run", "build")
		buildCmd.Dir = currentReleaseDir
	} else {
		streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Static layout detected.\n")
	}

	if buildCmd != nil {
		streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Compiling build scripts...\n")
		err = runCommandWithStreamingLogs(safeWrite, payload.DeploymentID, buildCmd)
		if err != nil {
			streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] ERROR: Build failed. Aborting.\n")
			sendStatus(safeWrite, payload.DeploymentID, "FAILED", commitHash, "")
			return
		}
	}

	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Phase 4/4: Configuration & Promoting Release...\n")

	// Write Systemd Service if dynamic
	if !isStatic {
		err = WriteSystemdService(projectName, payload.AssignedPort, false)
		if err != nil {
			streamLog(safeWrite, payload.DeploymentID, fmt.Sprintf("[SerDaddy] ERROR: Systemd config failed: %s\n", err.Error()))
			sendStatus(safeWrite, payload.DeploymentID, "FAILED", commitHash, "")
			return
		}
	}

	// Promote symlink target
	releasePath, err := SwapReleaseSymlink(projectName, commitHash, false)
	if err != nil {
		streamLog(safeWrite, payload.DeploymentID, fmt.Sprintf("[SerDaddy] ERROR: Release pointer swap failed: %s\n", err.Error()))
		sendStatus(safeWrite, payload.DeploymentID, "FAILED", commitHash, "")
		return
	}

	subdomain := payload.Subdomain
	if subdomain == "" {
		subdomain = projectName + ".local"
	}

	err = WriteNginxConfig(projectName, subdomain, payload.AssignedPort, isStatic, false)
	if err != nil {
		streamLog(safeWrite, payload.DeploymentID, fmt.Sprintf("[SerDaddy] ERROR: Nginx config failed: %s\n", err.Error()))
		sendStatus(safeWrite, payload.DeploymentID, "FAILED", commitHash, releasePath)
		return
	}

	if !isStatic {
		err = RestartProjectService(projectName, false)
		if err != nil {
			streamLog(safeWrite, payload.DeploymentID, fmt.Sprintf("[SerDaddy] ERROR: Service restart failed: %s\n", err.Error()))
			sendStatus(safeWrite, payload.DeploymentID, "FAILED", commitHash, releasePath)
			return
		}
	}

	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Swapped release symbolic links, reloaded routers, and restarted processes.\n")
	
	// Provision Let's Encrypt SSL using Certbot
	sslErr := ProvisionSSL(subdomain, "admin@serdaddy.com", false)
	if sslErr != nil {
		streamLog(safeWrite, payload.DeploymentID, fmt.Sprintf("[SerDaddy] WARNING: Let's Encrypt SSL registration skipped: %s\n", sslErr.Error()))
	} else {
		streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Let's Encrypt SSL certificate successfully configured.\n")
	}

	streamLog(safeWrite, payload.DeploymentID, "[SerDaddy] Build completed successfully!\n")

	sendStatus(safeWrite, payload.DeploymentID, "SUCCESS", commitHash, releasePath)
}

func runCommandWithStreamingLogs(safeWrite SafeWriteFunc, deploymentID string, cmd *exec.Cmd) error {
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	// Read logs and stream them concurrently
	reader := io.MultiReader(stdout, stderr)
	buf := make([]byte, 1024)
	for {
		n, err := reader.Read(buf)
		if n > 0 {
			streamLog(safeWrite, deploymentID, string(buf[:n]))
		}
		if err != nil {
			if err == io.EOF {
				break
			}
			return err
		}
	}

	return cmd.Wait()
}

type DeployDeletePayload struct {
	ProjectName string `json:"projectName"`
}

func ExecuteDeletion(safeWrite SafeWriteFunc, payloadRaw json.RawMessage, mock bool) {
	var payload DeployDeletePayload
	if err := json.Unmarshal(payloadRaw, &payload); err != nil {
		log.Printf("Failed to unmarshal deploy delete payload: %v", err)
		return
	}

	projectName := payload.ProjectName
	log.Printf("🗑️ Executing cleanup for project: %s", projectName)

	if mock {
		log.Printf("[Mock Deletion] Cleaned up configurations and folders for project %s", projectName)
		return
	}

	// 1. Stop and disable systemd service
	log.Printf("Stopping and disabling systemd service for %s...", projectName)
	_ = exec.Command("sudo", "systemctl", "stop", projectName).Run()
	_ = exec.Command("sudo", "systemctl", "disable", projectName).Run()

	// 2. Remove systemd service file
	serviceFilePath := fmt.Sprintf("/etc/systemd/system/%s.service", projectName)
	_ = exec.Command("sudo", "rm", "-f", serviceFilePath).Run()
	_ = exec.Command("sudo", "systemctl", "daemon-reload").Run()

	// 3. Remove Nginx configuration
	nginxAvailablePath := fmt.Sprintf("/etc/nginx/sites-available/%s", projectName)
	nginxEnabledPath := fmt.Sprintf("/etc/nginx/sites-enabled/%s", projectName)
	_ = exec.Command("sudo", "rm", "-f", nginxAvailablePath).Run()
	_ = exec.Command("sudo", "rm", "-f", nginxEnabledPath).Run()
	_ = exec.Command("sudo", "systemctl", "reload", "nginx").Run()

	// 4. Remove project folder
	projectDirPath := fmt.Sprintf("/var/www/projects/%s", projectName)
	_ = exec.Command("sudo", "rm", "-rf", projectDirPath).Run()

	log.Printf("✅ Project %s cleanup complete on host VPS.", projectName)
}

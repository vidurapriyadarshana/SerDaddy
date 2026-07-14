package runner

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

// WriteSystemdService generates a systemd service file for dynamic projects.
func WriteSystemdService(projectName string, port int, mock bool) error {
	if mock {
		log.Printf("[Mock Systemd] Generating service config for project %s on port %d", projectName, port)
		return nil
	}

	serviceContent := fmt.Sprintf(`[Unit]
Description=SerDaddy Application - %s
After=network.target

[Service]
Type=simple
User=serdaddy
WorkingDirectory=/var/www/projects/%s/current
ExecStart=/usr/bin/node dist/main.js
Restart=always
Environment=PORT=%d

[Install]
WantedBy=multi-user.target
`, projectName, projectName, port)

	servicePath := fmt.Sprintf("/etc/systemd/system/serdaddy-project-%s.service", projectName)
	err := ioutil.WriteFile(servicePath, []byte(serviceContent), 0644)
	if err != nil {
		return fmt.Errorf("failed to write systemd service file: %w", err)
	}

	// Reload systemd daemon
	cmd := exec.Command("sudo", "systemctl", "daemon-reload")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("systemd daemon-reload failed: %w", err)
	}

	// Enable service
	cmd = exec.Command("sudo", "systemctl", "enable", fmt.Sprintf("serdaddy-project-%s", projectName))
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("enabling systemd service failed: %w", err)
	}

	return nil
}

// WriteNginxConfig generates Nginx virtual block reverse proxy configuration.
func WriteNginxConfig(projectName string, subdomain string, port int, mock bool) error {
	if mock {
		log.Printf("[Mock Nginx] Writing reverse proxy block for subdomain %s -> local port %d", subdomain, port)
		return nil
	}

	nginxContent := fmt.Sprintf(`server {
    listen 80;
    server_name %s;

    location / {
        proxy_pass http://127.0.0.1:%d;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`, subdomain, port)

	availPath := fmt.Sprintf("/etc/nginx/sites-available/serdaddy-project-%s", projectName)
	enabPath := fmt.Sprintf("/etc/nginx/sites-enabled/serdaddy-project-%s", projectName)

	// Write to sites-available
	err := ioutil.WriteFile(availPath, []byte(nginxContent), 0644)
	if err != nil {
		return fmt.Errorf("failed to write nginx configuration to sites-available: %w", err)
	}

	// Symlink to sites-enabled
	if _, err := os.Lstat(enabPath); err == nil {
		os.Remove(enabPath) // Clean up old symlink if exists
	}
	err = os.Symlink(availPath, enabPath)
	if err != nil {
		return fmt.Errorf("failed to symlink nginx configuration: %w", err)
	}

	// Test and Reload Nginx
	cmd := exec.Command("sudo", "nginx", "-t")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("nginx config test failed: %w", err)
	}

	cmd = exec.Command("sudo", "systemctl", "reload", "nginx")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("nginx service reload failed: %w", err)
	}

	return nil
}

// Swaps the active release pointer to the specified commit folder.
func SwapReleaseSymlink(projectName string, commitHash string, mock bool) (string, error) {
	projectDir := fmt.Sprintf("/var/www/projects/%s", projectName)
	targetReleasePath := filepath.Join(projectDir, "releases", commitHash)
	currentSymlink := filepath.Join(projectDir, "current")

	if mock {
		log.Printf("[Mock Symlink] Swapping %s pointer to target release: %s", currentSymlink, targetReleasePath)
		return targetReleasePath, nil
	}

	// Remove old symlink
	if _, err := os.Lstat(currentSymlink); err == nil {
		os.Remove(currentSymlink)
	}

	// Create new symlink pointing to active release folder
	err := os.Symlink(targetReleasePath, currentSymlink)
	if err != nil {
		return "", fmt.Errorf("failed to update symlink: %w", err)
	}

	return targetReleasePath, nil
}

// RestartProjectService restarts the systemd service for the project.
func RestartProjectService(projectName string, mock bool) error {
	if mock {
		log.Printf("[Mock Systemd] Restarting serdaddy-project-%s service", projectName)
		return nil
	}

	serviceName := fmt.Sprintf("serdaddy-project-%s", projectName)
	cmd := exec.Command("sudo", "systemctl", "restart", serviceName)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("systemctl restart %s failed: %w", serviceName, err)
	}

	return nil
}

// ProvisionSSL configures an Nginx virtual server for SSL using Let's Encrypt Certbot.
func ProvisionSSL(subdomain string, email string, mock bool) error {
	if mock {
		log.Printf("[Mock SSL] Provisioning Let's Encrypt SSL certificate for %s using email %s", subdomain, email)
		return nil
	}

	log.Printf("🔒 Running Certbot SSL registration for %s...", subdomain)
	cmd := exec.Command("sudo", "certbot", "--nginx", "-d", subdomain, "-m", email, "--non-interactive", "--agree-tos", "--redirect")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("certbot command failed: %w. Output: %s", err, string(output))
	}

	log.Printf("✅ Certbot successfully configured SSL for %s", subdomain)
	return nil
}

Name:           kafka-accessor
Version:        0.0.1
Release:        1%{?dist}
Summary:        Kafka producer and consumer service with message processing capabilities

License:        MIT
URL:            https://github.com/yourusername/kafka-accessor
Source0:        %{name}-%{version}.tar.gz

BuildArch:      noarch
BuildRequires:  nodejs >= 16.0.0
BuildRequires:  npm
Requires:       nodejs >= 16.0.0

%description
A Kafka producer and consumer service with message processing capabilities.
Provides a configurable service for processing Kafka messages with custom processors.

%prep
%setup -q

%build
# Install production dependencies
npm ci --only=production

%install
rm -rf $RPM_BUILD_ROOT

# Create directories
mkdir -p $RPM_BUILD_ROOT%{_bindir}
mkdir -p $RPM_BUILD_ROOT%{_datadir}/%{name}
mkdir -p $RPM_BUILD_ROOT%{_sysconfdir}/%{name}
mkdir -p $RPM_BUILD_ROOT%{_unitdir}
mkdir -p $RPM_BUILD_ROOT%{_var}/log/%{name}
mkdir -p $RPM_BUILD_ROOT%{_var}/lib/%{name}

# Install application files
cp -r src processors node_modules $RPM_BUILD_ROOT%{_datadir}/%{name}/
cp index.js package.json README.md $RPM_BUILD_ROOT%{_datadir}/%{name}/

# Install configuration
cp config/kafka-cluster.env $RPM_BUILD_ROOT%{_sysconfdir}/%{name}/kafka.env

# Create executable wrapper
cat > $RPM_BUILD_ROOT%{_bindir}/%{name} << 'EOF'
#!/bin/bash
cd %{_datadir}/%{name}
exec node index.js "$@"
EOF
chmod +x $RPM_BUILD_ROOT%{_bindir}/%{name}

# Install systemd service files
cat > $RPM_BUILD_ROOT%{_unitdir}/%{name}-producer.service << 'EOF'
[Unit]
Description=Kafka Accessor Producer Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=kafka-accessor
Group=kafka-accessor
WorkingDirectory=%{_datadir}/%{name}
ExecStart=/usr/bin/node index.js producer
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kafka-accessor-producer

# Environment
Environment=NODE_ENV=production
EnvironmentFile=%{_sysconfdir}/%{name}/kafka.env

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=%{_var}/log/%{name} %{_var}/lib/%{name}

[Install]
WantedBy=multi-user.target
EOF

cat > $RPM_BUILD_ROOT%{_unitdir}/%{name}-consumer.service << 'EOF'
[Unit]
Description=Kafka Accessor Consumer Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=kafka-accessor
Group=kafka-accessor
WorkingDirectory=%{_datadir}/%{name}
ExecStart=/usr/bin/node index.js consumer
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kafka-accessor-consumer

# Environment
Environment=NODE_ENV=production
EnvironmentFile=%{_sysconfdir}/%{name}/kafka.env

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=%{_var}/log/%{name} %{_var}/lib/%{name}

[Install]
WantedBy=multi-user.target
EOF

%pre
# Create kafka-accessor user and group
getent group kafka-accessor >/dev/null || groupadd -r kafka-accessor
getent passwd kafka-accessor >/dev/null || \
    useradd -r -g kafka-accessor -d %{_var}/lib/%{name} -s /sbin/nologin \
    -c "Kafka Accessor service user" kafka-accessor

%post
%systemd_post %{name}-producer.service
%systemd_post %{name}-consumer.service

%preun
%systemd_preun %{name}-producer.service
%systemd_preun %{name}-consumer.service

%postun
%systemd_postun_with_restart %{name}-producer.service
%systemd_postun_with_restart %{name}-consumer.service

%files
%doc README.md
%{_bindir}/%{name}
%{_datadir}/%{name}/
%config(noreplace) %{_sysconfdir}/%{name}/kafka.env
%{_unitdir}/%{name}-producer.service
%{_unitdir}/%{name}-consumer.service
%attr(755, kafka-accessor, kafka-accessor) %{_var}/log/%{name}
%attr(755, kafka-accessor, kafka-accessor) %{_var}/lib/%{name}

%changelog
* Mon Dec 16 2024 Builder <builder@example.com> - 1.0.0-1
- Initial package release
- Kafka producer and consumer service
- Image processor support
- Systemd service integration

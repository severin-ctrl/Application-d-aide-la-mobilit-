    <!-- Leaflet JS -->
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
            integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
            crossorigin=""></script>
    
    <!-- Leaflet Routing Machine JS -->
    <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
    
    <!-- Modules JavaScript (ordre important) -->
    <?php $basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/'); ?>
    <script type="module" src="<?php echo $basePath; ?>/assets/js/api_client.js"></script>
    <script type="module" src="<?php echo $basePath; ?>/assets/js/map.js"></script>
    <script type="module" src="<?php echo $basePath; ?>/assets/js/app.js"></script>
</body>
</html>

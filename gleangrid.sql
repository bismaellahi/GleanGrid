-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 22, 2026 at 05:55 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `gleangrid`
--

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(60) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`) VALUES
(2, 'Fruit'),
(3, 'Spices'),
(1, 'Vegetables');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `buyer_id` int(11) NOT NULL,
  `status` enum('pending','confirmed','packed','dispatched','collected','cancelled','rejected','returned') NOT NULL DEFAULT 'pending',
  `total_amount` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `buyer_id`, `status`, `total_amount`, `created_at`) VALUES
(1, 7, 'rejected', 90.00, '2026-11-21 22:14:36'),
(2, 7, 'returned', 450.00, '2026-11-21 22:15:02'),
(3, 7, 'pending', 210.00, '2026-11-22 16:23:10');

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL CHECK (`qty` > 0),
  `unit_price` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `qty`, `unit_price`) VALUES
(1, 1, 4, 1, 90.00),
(2, 2, 4, 5, 90.00),
(3, 3, 5, 3, 70.00);

-- --------------------------------------------------------

--
-- Table structure for table `pos_sales`
--

CREATE TABLE `pos_sales` (
  `id` int(11) NOT NULL,
  `seller_id` int(11) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pos_sales`
--

INSERT INTO `pos_sales` (`id`, `seller_id`, `total_amount`, `created_at`) VALUES
(1, 8, 1080.00, '2026-11-22 16:18:17');

-- --------------------------------------------------------

--
-- Table structure for table `pos_sale_items`
--

CREATE TABLE `pos_sale_items` (
  `id` int(11) NOT NULL,
  `sale_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL CHECK (`qty` > 0),
  `unit_price` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pos_sale_items`
--

INSERT INTO `pos_sale_items` (`id`, `sale_id`, `product_id`, `qty`, `unit_price`) VALUES
(1, 1, 4, 2, 90.00),
(2, 1, 7, 3, 300.00);

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `seller_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` text DEFAULT NULL,
  `unit` varchar(20) NOT NULL DEFAULT 'kg',
  `unit_price` decimal(10,2) NOT NULL CHECK (`unit_price` > 0),
  `harvest_or_restock_date` date DEFAULT NULL,
  `pickup_delivery_info` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `seller_id`, `category_id`, `name`, `description`, `unit`, `unit_price`, `harvest_or_restock_date`, `pickup_delivery_info`) VALUES
(1, 1, 3, 'Red chillies', NULL, 'kg', 640.00, NULL, NULL),
(2, 2, 2, 'Dates', NULL, 'kg', 900.00, NULL, NULL),
(3, 3, 2, 'Mangoes', NULL, 'kg', 350.00, '2027-06-05', NULL),
(4, 8, 1, 'Cauliflower', NULL, 'kg', 90.00, NULL, NULL),
(5, 5, 1, 'Carrots', NULL, 'kg', 70.00, NULL, NULL),
(6, 8, 1, 'Onions', NULL, 'kg', 110.00, NULL, NULL),
(7, 8, 1, 'Green chillies', NULL, 'kg', 300.00, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `stock`
--

CREATE TABLE `stock` (
  `product_id` int(11) NOT NULL,
  `qty_on_hand` int(11) NOT NULL DEFAULT 0,
  `qty_reserved` int(11) NOT NULL DEFAULT 0
) ;

--
-- Dumping data for table `stock`
--

INSERT INTO `stock` (`product_id`, `qty_on_hand`, `qty_reserved`) VALUES
(1, 120, 35),
(2, 60, 60),
(3, 500, 80),
(4, 208, 20),
(5, 150, 43),
(6, 25, 8),
(7, 37, 0);

-- --------------------------------------------------------

--
-- Table structure for table `stock_movements`
--

CREATE TABLE `stock_movements` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `change_on_hand` int(11) NOT NULL DEFAULT 0,
  `change_reserved` int(11) NOT NULL DEFAULT 0,
  `reason` varchar(120) NOT NULL,
  `reference_type` varchar(20) DEFAULT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stock_movements`
--

INSERT INTO `stock_movements` (`id`, `product_id`, `change_on_hand`, `change_reserved`, `reason`, `reference_type`, `reference_id`, `created_at`) VALUES
(1, 4, 0, 1, 'Reserved: order placed', 'order', 1, '2026-11-21 22:14:36'),
(2, 4, 0, 5, 'Reserved: order placed', 'order', 2, '2026-11-21 22:15:02'),
(3, 4, -5, -5, 'Sold: order dispatched', 'order', 2, '2026-11-22 15:57:49'),
(4, 4, 0, -1, 'Released: order rejected', 'order', 1, '2026-11-22 15:58:26'),
(5, 4, 10, 0, 'Restocked by seller', 'product', 4, '2026-11-22 16:05:45'),
(6, 7, 40, 0, 'Restocked by seller', 'product', 7, '2026-11-22 16:07:47'),
(7, 4, -2, 0, 'Sold at counter', 'pos_sale', 1, '2026-11-22 16:18:17'),
(8, 7, -3, 0, 'Sold at counter', 'pos_sale', 1, '2026-11-22 16:18:17'),
(9, 5, 0, 3, 'Reserved: order placed', 'order', 3, '2026-11-22 16:23:10'),
(10, 4, 5, 0, 'Returned: stock restored', 'order', 2, '2026-11-22 16:50:32');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(120) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','seller','buyer') NOT NULL,
  `place` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `place`, `created_at`) VALUES
(1, 'Haji Ghulam Rasool', 'rasool@example.com', 'temp', 'seller', 'Kunri, Umerkot', '2026-11-21 20:28:57'),
(2, 'Ali Zaib Farms', 'alizaib@example.com', 'temp', 'seller', 'Khairpur', '2026-11-21 20:28:57'),
(3, 'Mirpur Orchards', 'mirpur@example.com', 'temp', 'seller', 'Mirpurkhas', '2026-11-21 20:28:57'),
(4, 'Noor Muhammad', 'noor@example.com', 'temp', 'seller', 'Hala', '2026-11-21 20:28:57'),
(5, 'Sanghar Growers', 'sanghar@example.com', 'temp', 'seller', 'Sanghar', '2026-11-21 20:28:57'),
(6, 'Wahid Bux', 'wahid@example.com', 'temp', 'seller', 'Tando Allahyar', '2026-11-21 20:28:57'),
(7, 'Bisma Ellahi', 'bismaellahi48@gmail.com', '$2b$10$P6qd5vzsjWhC2gyGKT6f1O/F4YXlpLzO/UWRfCQppesNTbX6EV.Zu', 'buyer', 'Hyderabad', '2026-11-21 21:43:47'),
(8, 'Haniya Khan', 'haniya@gmail.com', '$2b$10$Rje.e8iTI6vHaOPyA4JD8uUOE6C4olcMjNSH3o0uHFOw9aPh12eue', 'seller', 'Hyderabad', '2026-11-22 15:48:25'),
(9, 'Admin', 'admin@gleangrid.com', '$2b$10$F2olwuUdeVl6OG9c0iryuO7..k0u4ORpou.YodfslarPd6MX5OvIi', 'admin', 'Hyderabad', '2026-11-22 16:40:36');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `buyer_id` (`buyer_id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `pos_sales`
--
ALTER TABLE `pos_sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `seller_id` (`seller_id`);

--
-- Indexes for table `pos_sale_items`
--
ALTER TABLE `pos_sale_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sale_id` (`sale_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD KEY `seller_id` (`seller_id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `stock`
--
ALTER TABLE `stock`
  ADD PRIMARY KEY (`product_id`);

--
-- Indexes for table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `pos_sales`
--
ALTER TABLE `pos_sales`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `pos_sale_items`
--
ALTER TABLE `pos_sale_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `stock_movements`
--
ALTER TABLE `stock_movements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  ADD CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `pos_sales`
--
ALTER TABLE `pos_sales`
  ADD CONSTRAINT `pos_sales_ibfk_1` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `pos_sale_items`
--
ALTER TABLE `pos_sale_items`
  ADD CONSTRAINT `pos_sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `pos_sales` (`id`),
  ADD CONSTRAINT `pos_sale_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `products_ibfk_1` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `products_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`);

--
-- Constraints for table `stock`
--
ALTER TABLE `stock`
  ADD CONSTRAINT `stock_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD CONSTRAINT `stock_movements_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

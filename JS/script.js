const menuToggle = document.querySelector('.menu-toggle');
        const navigation = document.querySelector('.navigation');

        menuToggle.addEventListener('click', () => {
            navigation.classList.toggle('active')
        });

        const revealElements = document.querySelectorAll('.reveal');
        const observer = new IntersectionObserver((entries) => { entries.forEach(entry => {
            if(entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
        }, { threshold: 0.15 });

        revealElements.forEach(el => observer.observe(el));